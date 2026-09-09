import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { InsightService } from '../insight/insight.service';
import { NotFoundException } from '@nestjs/common';

describe('FinanceService', () => {
  let service: FinanceService;
  let prismaMock: any;
  let notificationMock: any;
  let insightMock: any;

  beforeEach(async () => {
    prismaMock = {
      transaction: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      budget: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      group: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    notificationMock = {
      send: jest.fn(),
    };

    insightMock = {
      generateInsights: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationService, useValue: notificationMock },
        { provide: InsightService, useValue: insightMock },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTransaction', () => {
    it('should create transaction and recalculate budget spent amount', async () => {
      const createdTx = {
        id: 'tx-1',
        userId: 'user-1',
        amount: 50,
        status: 'APPROVED',
        transactionType: 'EXPENSE',
      };
      prismaMock.transaction.create.mockResolvedValue(createdTx);
      prismaMock.budget.findFirst.mockResolvedValue({
        id: 'b-1',
        userId: 'user-1',
        spent: 100,
        limitAmount: 500,
      });
      prismaMock.budget.update.mockResolvedValue({});

      const result = await service.createTransaction('user-1', {
        amount: 50,
        description: 'Groceries',
        transactionType: 'EXPENSE',
        date: new Date().toISOString(),
        budgetId: 'b-1',
      });

      expect(result).toEqual(createdTx);
      expect(prismaMock.budget.update).toHaveBeenCalledWith({
        where: { id: 'b-1' },
        data: { spent: 150 },
      });
    });
  });
});
