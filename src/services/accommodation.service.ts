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

  const whereParams: any[] = [];
  const whereConditions: string[] = ['a.is_active = true'];

  if (city) {
    whereParams.push(`%${city}%`);
    whereConditions.push(`a.city ILIKE $${whereParams.length}`);
  }

  if (country) {
    whereParams.push(`%${country}%`);
    whereConditions.push(`a.country ILIKE $${whereParams.length}`);
  }

  if (star_rating) {
    whereParams.push(star_rating);
    whereConditions.push(`a.star_rating >= $${whereParams.length}`);
  }

  const havingParams: any[] = [];
  const havingConditions: string[] = [];

  if (min_price !== undefined) {
    havingParams.push(min_price);
    havingConditions.push(`MIN(r.price_per_night) >= $${whereParams.length + havingParams.length}`);
  }

  if (max_price !== undefined) {
    havingParams.push(max_price);
    havingConditions.push(`MIN(r.price_per_night) <= $${whereParams.length + havingParams.length}`);
  }

  // amenities may be provided as an array (from query) or object (from body).
  let amenityJoin = '';
  if (Array.isArray(amenities) && amenities.length > 0) {
    whereParams.push(amenities);
    amenityJoin = `
      INNER JOIN (
        SELECT aa.accommodation_id
        FROM accommodation_amenities aa
        INNER JOIN amenities am ON aa.amenity_id = am.id
        WHERE am.name = ANY($${whereParams.length})
        GROUP BY aa.accommodation_id
        HAVING COUNT(DISTINCT am.name) = ${amenities.length}
      ) af ON a.id = af.accommodation_id
    `;
  }

  const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';
  const havingClause = havingConditions.length ? `HAVING ${havingConditions.join(' AND ')}` : '';

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
      MIN(r.price_per_night) as min_price,
      COUNT(DISTINCT rv.id) as review_count,
      COALESCE(AVG(rv.rating), 0) as avg_rating
    FROM accommodations a
    LEFT JOIN rooms r ON a.id = r.accommodation_id
    LEFT JOIN reviews rv ON a.id = rv.accommodation_id
    ${amenityJoin}
    ${whereClause}
    GROUP BY a.id, a.name, a.description, a.address, a.city, a.country, a.star_rating, a.latitude, a.longitude, a.created_at
    ${havingClause}
    ORDER BY a.created_at DESC
    LIMIT $${whereParams.length + havingParams.length + 1} OFFSET $${whereParams.length + havingParams.length + 2}
  `;

  const params = [...whereParams, ...havingParams, limit, offset];
  const result = await query(queryText, params);

  const countQuery = `
    SELECT COUNT(DISTINCT a.id) as total
    FROM accommodations a
    LEFT JOIN rooms r ON a.id = r.accommodation_id
    ${amenityJoin}
    ${whereClause}
  `;
  const countResult = await query(countQuery, whereParams);
  const total = parseInt(countResult.rows[0]?.total || '0', 10);

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
        json_build_object(
          'general', json_agg(DISTINCT am.name) FILTER (WHERE am.id IS NOT NULL)
        ) as amenities
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
      postal_code,
      city,
      country,
      star_rating,
      latitude,
      longitude,
      photos,
      amenities,
    } = data;

    // Insert accommodation
    const result = await client.query(
      `INSERT INTO accommodations (
        owner_id, name, description, address, postal_code, city, country,
        star_rating, latitude, longitude, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        ownerId || null,
        name,
        description || null,
        address,
        postal_code || 'N/A',
        city,
        country,
        star_rating || null,
        latitude || null,
        longitude || null,
        true,
      ]
    );

    const accommodationId = result.rows[0].id;

    // Insert photos if provided
    if (photos && Array.isArray(photos) && photos.length > 0) {
      await client.query(
        `INSERT INTO photos (accommodation_id, url, caption)
         SELECT $1, p.url, p.caption
         FROM jsonb_to_recordset($2::jsonb) AS p(url TEXT, caption TEXT)`,
        [accommodationId, JSON.stringify(photos)]
      );
    }

    // Insert amenities if provided
    if (amenities && typeof amenities === 'object') {
      const amenityNames: string[] = [];
      Object.values(amenities).forEach((items: any) => {
        if (Array.isArray(items)) {
          amenityNames.push(...items.filter(Boolean));
        }
      });

      if (amenityNames.length > 0) {
        // First ensure amenities exist
        await client.query(
          `INSERT INTO amenities (name)
           SELECT DISTINCT unnest($1::text[])
           ON CONFLICT (name) DO NOTHING`,
          [amenityNames]
        );

        // Then link them to the accommodation
        await client.query(
          `WITH amenity_ids AS (
             SELECT id FROM amenities WHERE name = ANY($1::text[])
           )
           INSERT INTO accommodation_amenities (accommodation_id, amenity_id)
           SELECT $2, id FROM amenity_ids`,
          [amenityNames, accommodationId]
        );
      }
    }

    // Return complete accommodation with photos and amenities
    const completeResult = await client.query(
      `SELECT 
         a.*,
         json_agg(DISTINCT jsonb_build_object('id', p.id, 'url', p.url, 'caption', p.caption)) FILTER (WHERE p.id IS NOT NULL) as photos,
         json_build_object('general', json_agg(DISTINCT am.name) FILTER (WHERE am.id IS NOT NULL)) as amenities
       FROM accommodations a
       LEFT JOIN photos p ON a.id = p.accommodation_id
       LEFT JOIN accommodation_amenities aa ON a.id = aa.accommodation_id
       LEFT JOIN amenities am ON aa.amenity_id = am.id
       WHERE a.id = $1
       GROUP BY a.id`,
      [accommodationId]
    );

    return completeResult.rows[0];
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
      postal_code,
      city,
      country,
      star_rating,
      latitude,
      longitude,
      photos,
      amenities,
    } = data;

    // Update basic accommodation info
    const result = await client.query(
      `UPDATE accommodations
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           address = COALESCE($3, address),
           postal_code = COALESCE($4, postal_code, 'N/A'),
           city = COALESCE($5, city),
           country = COALESCE($6, country),
           star_rating = COALESCE($7, star_rating),
           latitude = COALESCE($8, latitude),
           longitude = COALESCE($9, longitude),
           updated_at = NOW()
       WHERE id = $10 AND is_active = true
       RETURNING *`,
      [name, description, address, postal_code, city, country, star_rating, latitude, longitude, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Accommodation not found', 404);
    }

    // Update photos if provided
    if (photos && Array.isArray(photos)) {
      // Delete existing photos
      await client.query(
        `DELETE FROM photos WHERE accommodation_id = $1`,
        [id]
      );

      if (photos.length > 0) {
        // Insert new photos
        await client.query(
          `INSERT INTO photos (accommodation_id, url, caption)
           SELECT $1, p.url, p.caption
           FROM jsonb_to_recordset($2::jsonb) AS p(url TEXT, caption TEXT)`,
          [id, JSON.stringify(photos)]
        );
      }
    }

    // Update amenities if provided
      let amenityNames: string[] = [];
      if (amenities && typeof amenities === 'object') {
        // Delete existing amenity links
        await client.query(
          `DELETE FROM accommodation_amenities WHERE accommodation_id = $1`,
          [id]
        );

        Object.values(amenities).forEach(items => {
        if (Array.isArray(items)) {
            amenityNames = amenityNames.concat(items);
        }
      });

        if (amenityNames.length > 0) {
        // Ensure amenities exist
        await client.query(
          `INSERT INTO amenities (name)
           SELECT DISTINCT unnest($1::text[])
           ON CONFLICT (name) DO NOTHING`,
            [amenityNames]
        );

        // Link them to the accommodation
        await client.query(
          `WITH amenity_ids AS (
             SELECT id FROM amenities WHERE name = ANY($1::text[])
           )
           INSERT INTO accommodation_amenities (accommodation_id, amenity_id)
           SELECT $2, id FROM amenity_ids`,
            [amenityNames, id]
        );
      }
    }

    // Return complete updated accommodation with photos and amenities
    const completeResult = await client.query(
      `SELECT 
         a.*,
         json_agg(DISTINCT jsonb_build_object(
           'id', p.id,
           'url', p.url,
           'caption', p.caption
         )) FILTER (WHERE p.id IS NOT NULL) as photos,
           json_build_object(
             'general', json_agg(DISTINCT am.name) FILTER (WHERE am.id IS NOT NULL)
           ) as amenities
       FROM accommodations a
       LEFT JOIN photos p ON a.id = p.accommodation_id
       LEFT JOIN accommodation_amenities aa ON a.id = aa.accommodation_id
       LEFT JOIN amenities am ON aa.amenity_id = am.id
       WHERE a.id = $1
       GROUP BY a.id`,
      [id]
    );

    return completeResult.rows[0];
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