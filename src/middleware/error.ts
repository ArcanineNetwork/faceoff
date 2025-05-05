import { ErrorRequestHandler } from 'express';
import { logger } from '../logger';

// Error handler middleware
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  logger.error('Error in request:', {
    path: req.path,
    method: req.method,
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });

  // Don't expose error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorDetails = isDevelopment ? {
    message: error.message,
    stack: error.stack
  } : {
    message: 'Internal server error'
  };

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: errorDetails
    });
  }

  // Handle MongoDB errors
  if (error.name === 'MongoError') {
    return res.status(500).json({
      error: 'Database error',
      details: errorDetails
    });
  }

  // Handle Zod validation errors
  if (error.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: errorDetails
    });
  }

  // Handle not found errors
  if (error.status === 404) {
    return res.status(404).json({
      error: 'Not found',
      details: errorDetails
    });
  }

  // Default error handling
  res.status(500).json({
    error: 'Internal server error',
    details: errorDetails
  });
};
