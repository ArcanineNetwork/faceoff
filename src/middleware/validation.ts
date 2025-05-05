import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError, ZodType, z } from 'zod';

// Base middleware functions
export const validateRequest = (schema: ZodType): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse(req.body);
      req.body = result;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
        return;
      }
      next(error as Error);
    }
  };
};

export const validateQuery = (schema: ZodType): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse(req.query);
      req.query = result;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
        return;
      }
      next(error as Error);
    }
  };
};

export const validateParams = (schema: ZodType): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse(req.params);
      req.params = result;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
        return;
      }
      next(error as Error);
    }
  };
};

// Schemas
export const QuestionSchema = z.object({
  text: z.string().min(1, 'Question text is required'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

export const QuestionSetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  questions: z.array(QuestionSchema).min(1, 'At least one question is required')
});

export const UpdateQuestionSetSchema = QuestionSetSchema.partial();

export const PaginationQuerySchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional()
});

export const AddQuestionsSchema = z.object({
  questions: z.array(QuestionSchema).min(1, 'At least one question is required')
});

export const GetQuestionSetSchema = z.object({
  id: z.string().uuid()
});

// Types
export type Question = z.infer<typeof QuestionSchema>;
export type QuestionSet = z.infer<typeof QuestionSetSchema>;
export type UpdateQuestionSet = z.infer<typeof UpdateQuestionSetSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type AddQuestions = z.infer<typeof AddQuestionsSchema>;
