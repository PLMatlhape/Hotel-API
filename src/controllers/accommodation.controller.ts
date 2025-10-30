import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import * as accommodationService from '../services/accommodation.service.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

// =============================================
// SEARCH ACCOMMODATIONS
// =============================================
export const searchAccommodations = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const filters = {
      city: req.query.city as string,
      country: req.query.country as string,
      checkin_date: req.query.checkin_date as string,
      checkout_date: req.query.checkout_date as string,
      guest_count: req.query.guest_count ? parseInt(req.query.guest_count as string) : undefined,
      min_price: req.query.min_price ? parseFloat(req.query.min_price as string) : undefined,
      max_price: req.query.max_price ? parseFloat(req.query.max_price as string) : undefined,
      star_rating: req.query.star_rating ? parseInt(req.query.star_rating as string) : undefined,
      amenities: req.query.amenities ? (req.query.amenities as string).split(',') : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
    };

  const result: any = await accommodationService.searchAccommodations(filters as any);

    res.status(200).json({
      success: true,
      data: result.accommodations,
      pagination: result.pagination,
    });
  }
);

// =============================================
// GET ACCOMMODATION BY ID
// =============================================
export const getAccommodationById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!id) throw new AppError('Accommodation id is required', 400);

  const accommodation = await accommodationService.getAccommodationById(id);

    res.status(200).json({
      success: true,
      data: accommodation,
    });
  }
);

// =============================================
// CREATE ACCOMMODATION (ADMIN)
// =============================================
export const createAccommodation = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const ownerId = req.user?.id;

    const accommodation = await accommodationService.createAccommodation(
      req.body,
      ownerId
    );

    res.status(201).json({
      success: true,
      message: 'Accommodation created successfully',
      data: accommodation,
    });
  }
);

// =============================================
// UPDATE ACCOMMODATION (ADMIN)
// =============================================
export const updateAccommodation = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    if (!id) throw new AppError('Accommodation id is required', 400);

    const accommodation = await accommodationService.updateAccommodation(
      id,
      req.body
    );

    res.status(200).json({
      success: true,
      message: 'Accommodation updated successfully',
      data: accommodation,
    });
  }
);

// =============================================
// DELETE ACCOMMODATION (ADMIN)
// =============================================
export const deleteAccommodation = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!id) throw new AppError('Accommodation id is required', 400);

  await accommodationService.deleteAccommodation(id);

    res.status(200).json({
      success: true,
      message: 'Accommodation deleted successfully',
    });
  }
);

// =============================================
// CREATE ROOM (ADMIN)
// =============================================
export const createRoom = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { accommodationId } = req.params;
    if (!accommodationId) throw new AppError('Accommodation id is required', 400);

    const room = await accommodationService.createRoom(accommodationId, req.body);

    res.status(201).json({
      success: true,
      message: 'Room created successfully',
      data: room,
    });
  }
);

// =============================================
// UPDATE ROOM (ADMIN)
// =============================================
export const updateRoom = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { roomId } = req.params;
    if (!roomId) throw new AppError('Room id is required', 400);

    const room = await accommodationService.updateRoom(roomId, req.body);

    res.status(200).json({
      success: true,
      message: 'Room updated successfully',
      data: room,
    });
  }
);

// =============================================
// GET ROOM BY ID (PUBLIC)
// =============================================
export const getRoomById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { roomId } = req.params;
    if (!roomId) throw new AppError('Room id is required', 400);

    const room = await accommodationService.getRoomById(roomId);

    res.status(200).json({
      success: true,
      data: room,
    });
  }
);

// =============================================
// DELETE ROOM (ADMIN)
// =============================================
export const deleteRoom = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { roomId } = req.params;
    if (!roomId) throw new AppError('Room id is required', 400);

    await accommodationService.deleteRoom(roomId);

    res.status(200).json({
      success: true,
      message: 'Room deleted successfully',
    });
  }
);

// =============================================
// GET ALL ROOMS (ADMIN)
// =============================================
export const getAllRoomsAdmin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const rooms = await accommodationService.getAllRoomsAdmin();

    res.status(200).json({
      success: true,
      data: rooms,
    });
  }
);

// =============================================
// GET ROOMS BY ACCOMMODATION ID (PUBLIC)
// =============================================
export const getRoomsByAccommodationId = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { accommodationId } = req.params;
    if (!accommodationId) throw new AppError('Accommodation id is required', 400);

    const rooms = await accommodationService.getRoomsByAccommodationId(accommodationId);

    res.status(200).json({
      success: true,
      data: rooms,
    });
  }
);
