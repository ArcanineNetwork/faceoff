import mongoose, { Schema } from 'mongoose';
import { logger } from '../logger';

export interface Question {
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionSet {
  _id: mongoose.Types.ObjectId;
  name: string;
  questions: Question[];
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const questionSetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  questions: [questionSchema]
}, {
  timestamps: true
});

questionSetSchema.pre('save', function(this: mongoose.Document, next) {
  if (this.isModified('questions')) {
    (this.get('questions') as Question[]).forEach(question => {
      question.updatedAt = new Date();
    });
  }
  next();
});

questionSetSchema.pre('findOneAndUpdate', function(this: mongoose.Query<any, any>, next) {
  const update = this.getUpdate() as mongoose.UpdateWithAggregationPipeline;
  if (update.$set && update.$set.questions) {
    (update.$set.questions as Question[]).forEach((question: Question) => {
      question.updatedAt = new Date();
    });
  }
  next();
});

export const QuestionSet = mongoose.model<QuestionSet>('QuestionSet', questionSetSchema);
