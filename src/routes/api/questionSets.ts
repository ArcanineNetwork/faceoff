import { Router, Request, Response } from 'express';
import QuestionSetService from '../../services/questionSetService';
import { validateQuery, validateParams, validateRequest, PaginationQuerySchema, GetQuestionSetSchema, QuestionSchema } from '../../middleware/validation';

const router = Router();
const questionSetService = new QuestionSetService();

// Helper type for route handlers
const createHandler = <T extends (req: Request, res: Response) => Promise<void>>(handler: T) => handler;

// Get all question sets with pagination
router.get('/',
  validateQuery(PaginationQuerySchema),
  createHandler(async (req: Request, res: Response) => {
    try {
      const { questionSets, totalCount } = await questionSetService.getQuestionSets(
        parseInt(req.query.page as string) || 1,
        parseInt(req.query.limit as string) || 10
      );
      res.json({
        data: questionSets,
        meta: {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 10,
          totalCount,
          totalPages: Math.ceil(totalCount / (parseInt(req.query.limit as string) || 10))
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get question sets' });
    }
  })
);

// Get a single question set by ID
router.get('/:id',
  validateParams(GetQuestionSetSchema),
  createHandler(async (req: Request, res: Response) => {
    try {
      const questionSet = await questionSetService.getQuestionSet(req.params.id);
      if (!questionSet) {
        res.status(404).json({ error: 'QuestionSet not found' });
      }
      res.json(questionSet);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get question set' });
    }
  })
);

// Add a single question to a question set
router.post(
  '/:id/questions',
  validateParams(GetQuestionSetSchema),
  validateRequest(QuestionSchema),
  createHandler(async (req: Request, res: Response) => {
    try {
      const questionSet = await questionSetService.getQuestionSet(req.params.id);
      if (!questionSet) {
        return res.status(404).json({ error: 'QuestionSet not found' });
      }

      const updatedQuestionSet = await questionSetService.addQuestions(req.params.id, [req.body]);
      res.status(201).json(updatedQuestionSet);
    } catch (error) {
      res.status(500).json({ error: 'Failed to add question' });
    }
  })
);

router.get('/:id/questions',
  validateParams(GetQuestionSetSchema),
  createHandler(async (req: Request, res: Response) => {
    try {
      const questionSet = await questionSetService.getQuestionSet(req.params.id);
      if (!questionSet) {
        return res.status(404).json({ error: 'QuestionSet not found' });
      }
      res.json({ questions: questionSet.questions });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get questions' });
    }
  })
);

export default router;
