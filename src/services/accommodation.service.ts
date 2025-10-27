import { query, transaction } from '../config/database.js';
import { Accommodation, SearchFilters } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';

// =============================================
// SEARCH ACCOMMODATIONS (OPTIMIZED)
// =============================================
export const searchAccommodations = async (filters: SearchFilters) => {
  const {
    city,
    country,
    checkin_date,
    checkout_date,
    guest_count,
    min_price,
    max_price,
    star_rating,
    amenities,
    page = 1,
    limit = 10,
  } = filters;

  const offset = (page - 1) * limit;
  const params: any[] = [];
  let paramCount = 0;

  // Build dynamic WHERE clause
  const conditions: string[] = ['a.is_active = true'];

  if (city) {
    paramCount++;
    conditions.push(`a.city ILIKE $${paramCount}`);
    params.push(`%${city}%`);
  }

  if (country) {
    paramCount++;
    conditions.push(`a.country ILIKE $${paramCount}`);
    params.push(`%${country}%`);
  }

  if (star_rating) {
    paramCount++;
    conditions.push(`a.star_rating >= $${paramCount}`);
    params.push(star_rating);
  }

  // Price filter (based on minimum room price)
  let priceCondition = '';
  if (min_price || max_price) {
    const priceConditions: string[] = [];
    
    if (min_price) {
      paramCount++;
      priceConditions.push(`MIN(r.base_price) >= $${paramCount}`);
      params.push(min_price);
    }
    
    if (max_price) {
      paramCount++;
      priceConditions.push(`MIN(r.base_price) <= $${paramCount}`);
      params.push(max_price);
    }
    
    priceCondition = `HAVING ${priceConditions.join(' AND ')}`;
  }

  // Amenities filter
  let amenityJoin = '';
  if (amenities && amenities.length > 0) {
    paramCount++;
    amenityJoin = `
      INNER JOIN (
        SELECT aa.accommodation_id
        FROM accommodation_amenities aa
        INNER JOIN amenities am ON aa.amenity_id = am.id
        WHERE am.name = ANY($${paramCount})
        GROUP BY aa.accommodation_id
        HAVING COUNT(DISTINCT am.name) = ${amenities.length}
      ) af ON a.id = af.accommodation_id
    `;
    params.push(amenities);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const queryText = `
    SELECT
      a.id,
      a.name,
      a.description,
      a.address,
      a.city,
      a.country,
      a.star_rating,
      a.latitude,
      a.longitude,
      a.created_at,
      MIN(r.base_price) as min_price,
      COUNT(DISTINCT rv.id) as review_count,
      COALESCE(AVG(rv.rating), 0) as avg_rating
    FROM accommodations a
    LEFT JOIN rooms r ON a.id = r.accommodation_id
    LEFT JOIN reviews rv ON a.id = rv.accommodation_id
    ${amenityJoin}
    ${whereClause}
    GROUP BY a.id, a.name, a.description, a.address, a.city, a.country, a.star_rating, a.latitude, a.longitude, a.created_at
    ${priceCondition}
    ORDER BY a.created_at DESC
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
  `;

  params.push(limit, offset);

  const result = await query(queryText, params);

  // Count query for pagination
  const countQuery = `
    SELECT COUNT(DISTINCT a.id) as total
    FROM accommodations a
    LEFT JOIN rooms r ON a.id = r.accommodation_id
    ${amenityJoin}
    ${whereClause}
  `;

  const countResult = await query(countQuery, params.slice(0, paramCount));
  const total = parseInt(countResult.rows[0].total);

  return {
    accommodations: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// =============================================
// GET ACCOMMODATION BY ID
// =============================================
export const getAccommodationById = async (id: string) => {
  const result = await query(
    `SELECT
      a.*,
      COALESCE(AVG(rv.rating), 0) as avg_rating,
      COUNT(DISTINCT rv.id) as review_count,
      json_agg(
        DISTINCT jsonb_build_object(
          'id', p.id,
          'url', p.url,
          'caption', p.caption
        )
      ) FILTER (WHERE p.id IS NOT NULL) as photos,
      json_agg(
        DISTINCT jsonb_build_object(
          'id', am.id,
          'name', am.name,
          'icon', am.icon
        )
      ) FILTER (WHERE am.id IS NOT NULL) as amenities
    FROM accommodations a
    LEFT JOIN reviews rv ON a.id = rv.accommodation_id
    LEFT JOIN photos p ON a.id = p.accommodation_id
    LEFT JOIN accommodation_amenities aa ON a.id = aa.accommodation_id
    LEFT JOIN amenities am ON aa.amenity_id = am.id
    WHERE a.id = $1 AND a.is_active = true
    GROUP BY a.id`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new AppError('Accommodation not found', 404);
  }

  return result.rows[0];
};

// =============================================
// CREATE ACCOMMODATION
// =============================================
export const createAccommodation = async (data: any, ownerId?: string) => {
  return transaction(async (client) => {
    const {
      name,
      description,
      address,
      city,
      country,
      star_rating,
      latitude,
      longitude,
    } = data;

    const result = await client.query(
      `INSERT INTO accommodations (
        owner_id, name, description, address, city, country,
        star_rating, latitude, longitude, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        ownerId || null,
        name,
        description || null,
        address,
        city,
        country,
        star_rating || null,
        latitude || null,
        longitude || null,
        true,
      ]
    );

    return result.rows[0];
  });
};

// =============================================
// UPDATE ACCOMMODATION
// =============================================
export const updateAccommodation = async (id: string, data: any) => {
  return transaction(async (client) => {
    const {
      name,
      description,
      address,
      city,
      country,
      star_rating,
      latitude,
      longitude,
    } = data;

    const result = await client.query(
      `UPDATE accommodations
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           address = COALESCE($3, address),
           city = COALESCE($4, city),
           country = COALESCE($5, country),
           star_rating = COALESCE($6, star_rating),
           latitude = COALESCE($7, latitude),
           longitude = COALESCE($8, longitude),
           updated_at = NOW()
       WHERE id = $9 AND is_active = true
       RETURNING *`,
      [name, description, address, city, country, star_rating, latitude, longitude, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Accommodation not found', 404);
    }

    return result.rows[0];
  });
};

// =============================================
// DELETE ACCOMMODATION (SOFT DELETE)
// =============================================
export const deleteAccommodation = async (id: string) => {
  const result = await query(
    `UPDATE accommodations
     SET is_active = false, updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new AppError('Accommodation not found', 404);
  }

  return { message: 'Accommodation deleted successfully' };
};