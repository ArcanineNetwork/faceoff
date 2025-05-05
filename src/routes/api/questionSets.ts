import { Router, Request, Response } from 'express';
import QuestionSetService from '../../services/questionSetService';
import { validateQuery, validateParams, PaginationQuerySchema, GetQuestionSetSchema } from '../../middleware/validation';

const router = Router();
const questionSetService = new QuestionSetService();

// Get all question sets with pagination
router.get('/', validateQuery(PaginationQuerySchema), async (req: Request, res: Response) => {
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
});

// Get a single question set by ID
router.get('/:id', validateParams(GetQuestionSetSchema), async (req: Request, res: Response) => {
    try {
      const questionSet = await questionSetService.getQuestionSet(req.params.id);
      if (!questionSet) {
        res.status(404).json({ error: 'QuestionSet not found' });
      }
      res.json(questionSet);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get question set' });
    }
  }
);

export default router;
