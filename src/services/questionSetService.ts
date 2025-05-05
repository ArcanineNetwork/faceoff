import { QuestionSet } from '../models/QuestionSet';
import { logger } from '../logger';

export interface QuestionSetServiceInterface {
  createQuestionSet(name: string, questions: any[]): Promise<QuestionSet>;
  getQuestionSet(id: string): Promise<QuestionSet | null>;
  getQuestionSets(page: number, limit: number): Promise<{ questionSets: QuestionSet[], totalCount: number }>;
  addQuestions(id: string, questions: any[]): Promise<QuestionSet>;
  updateQuestionSet(id: string, updates: Partial<QuestionSet>): Promise<QuestionSet | null>;
  deleteQuestionSet(id: string): Promise<void>;
}

export default class QuestionSetService implements QuestionSetServiceInterface {
  async createQuestionSet(name: string, questions: any[]): Promise<QuestionSet> {
    try {
      const questionSet = new QuestionSet({
        name,
        questions: questions.map(q => ({
          text: q.text,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      });
      await questionSet.save();
      logger.info('QuestionSet created', { questionSetId: questionSet._id });
      return questionSet;
    } catch (error) {
      logger.error('Failed to create QuestionSet', { error });
      throw error;
    }
  }

  async getQuestionSet(id: string): Promise<QuestionSet | null> {
    try {
      const questionSet = await QuestionSet.findById(id);
      logger.info('QuestionSet retrieved', { questionSetId: id });
      return questionSet;
    } catch (error) {
      logger.error('Failed to get QuestionSet', { error, questionSetId: id });
      throw error;
    }
  }

  async getQuestionSets(page: number = 1, limit: number = 10): Promise<{ questionSets: QuestionSet[], totalCount: number }> {
    try {
      const skip = (page - 1) * limit;
      const [questionSets, totalCount] = await Promise.all([
        QuestionSet.find()
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 }),
        QuestionSet.countDocuments()
      ]);
      logger.info('QuestionSets retrieved', { page, limit, totalCount });
      return { questionSets, totalCount };
    } catch (error) {
      logger.error('Failed to get QuestionSets', { error, page, limit });
      throw error;
    }
  }

  async addQuestions(id: string, questions: any[]): Promise<QuestionSet> {
    try {
      const questionSet = await QuestionSet.findById(id);
      if (!questionSet) {
        throw new Error('QuestionSet not found');
      }

      questionSet.questions.push(...questions.map(q => ({
        text: q.text,
        createdAt: new Date(),
        updatedAt: new Date()
      })));

      await questionSet.save();
      logger.info('Questions added to QuestionSet', { questionSetId: id, questionCount: questions.length });
      return questionSet;
    } catch (error) {
      logger.error('Failed to add questions to QuestionSet', { error, questionSetId: id });
      throw error;
    }
  }

  async updateQuestionSet(id: string, updates: Partial<QuestionSet>): Promise<QuestionSet | null> {
    try {
      const questionSet = await QuestionSet.findByIdAndUpdate(
        id,
        updates,
        { new: true, runValidators: true }
      );
      logger.info('QuestionSet updated', { questionSetId: id });
      return questionSet;
    } catch (error) {
      logger.error('Failed to update QuestionSet', { error, questionSetId: id });
      throw error;
    }
  }

  async deleteQuestionSet(id: string): Promise<void> {
    try {
      await QuestionSet.findByIdAndDelete(id);
      logger.info('QuestionSet deleted', { questionSetId: id });
    } catch (error) {
      logger.error('Failed to delete QuestionSet', { error, questionSetId: id });
      throw error;
    }
  }
}
