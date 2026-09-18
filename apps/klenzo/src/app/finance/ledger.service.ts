import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Ledger Service — Double-Entry Accounting
 *
 * Every financial mutation creates ledger entries that maintain
 * running balances per wallet. The ledger is the source of truth
 * for wallet balances.
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Post a debit entry (money leaving a wallet).
   * Verifies sufficient balance before posting.
   */
  async postDebit(params: {
    walletId: string;
    amount: number;
    currency: string;
    description?: string;
    reference?: string;
    transactionId?: string;
    transferId?: string;
  }): Promise<void> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: params.walletId },
    });
    if (!wallet) throw new BadRequestException('Wallet not found');

    const balance = new Prisma.Decimal(wallet.balance);
    const amount = new Prisma.Decimal(params.amount);

    if (balance.lessThan(amount)) {
      throw new BadRequestException(
        `Insufficient balance: ${balance} ${wallet.currency} < ${amount} ${params.currency}`,
      );
    }

    const newBalance = balance.minus(amount);

    await this.prisma.$transaction(async (tx) => {
      // Create the ledger entry
      await tx.ledgerEntry.create({
        data: {
          walletId: params.walletId,
          type: 'DEBIT',
          amount,
          balance: newBalance,
          status: 'POSTED',
          description: params.description,
          reference: params.reference,
          currency: params.currency,
          transactionId: params.transactionId,
          transferId: params.transferId,
        },
      });

      // Update wallet balance
      await tx.wallet.update({
        where: { id: params.walletId },
        data: { balance: newBalance },
      });
    });
  }

  /**
   * Post a credit entry (money entering a wallet).
   */
  async postCredit(params: {
    walletId: string;
    amount: number;
    currency: string;
    description?: string;
    reference?: string;
    transactionId?: string;
    transferId?: string;
  }): Promise<void> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: params.walletId },
    });
    if (!wallet) throw new BadRequestException('Wallet not found');

    const balance = new Prisma.Decimal(wallet.balance);
    const amount = new Prisma.Decimal(params.amount);
    const newBalance = balance.plus(amount);

    await this.prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.create({
        data: {
          walletId: params.walletId,
          type: 'CREDIT',
          amount,
          balance: newBalance,
          status: 'POSTED',
          description: params.description,
          reference: params.reference,
          currency: params.currency,
          transactionId: params.transactionId,
          transferId: params.transferId,
        },
      });

      await tx.wallet.update({
        where: { id: params.walletId },
        data: { balance: newBalance },
      });
    });
  }

  /**
   * Post a paired debit+credit for a transfer between two wallets.
   * Atomic — both entries succeed or neither does.
   */
  async postTransfer(params: {
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    currency: string;
    description?: string;
    transferId: string;
  }): Promise<void> {
    if (params.fromWalletId === params.toWalletId) {
      throw new BadRequestException('Cannot transfer to the same wallet');
    }

    const [fromWallet, toWallet] = await Promise.all([
      this.prisma.wallet.findUnique({ where: { id: params.fromWalletId } }),
      this.prisma.wallet.findUnique({ where: { id: params.toWalletId } }),
    ]);

    if (!fromWallet || !toWallet) throw new BadRequestException('Wallet not found');

    const fromBalance = new Prisma.Decimal(fromWallet.balance);
    const toBalance = new Prisma.Decimal(toWallet.balance);
    const amount = new Prisma.Decimal(params.amount);

    if (fromBalance.lessThan(amount)) {
      throw new BadRequestException('Insufficient balance for transfer');
    }

    await this.prisma.$transaction(async (tx) => {
      // Debit sender
      const newFromBalance = fromBalance.minus(amount);
      await tx.ledgerEntry.create({
        data: {
          walletId: params.fromWalletId,
          type: 'DEBIT',
          amount,
          balance: newFromBalance,
          status: 'POSTED',
          description: params.description ?? `Transfer to ${toWallet.name}`,
          reference: params.transferId,
          currency: params.currency,
          transferId: params.transferId,
        },
      });
      await tx.wallet.update({
        where: { id: params.fromWalletId },
        data: { balance: newFromBalance },
      });

      // Credit receiver
      const newToBalance = toBalance.plus(amount);
      await tx.ledgerEntry.create({
        data: {
          walletId: params.toWalletId,
          type: 'CREDIT',
          amount,
          balance: newToBalance,
          status: 'POSTED',
          description: params.description ?? `Transfer from ${fromWallet.name}`,
          reference: params.transferId,
          currency: params.currency,
          transferId: params.transferId,
        },
      });
      await tx.wallet.update({
        where: { id: params.toWalletId },
        data: { balance: newToBalance },
      });
    });
  }

  /**
   * Reverse a ledger entry by posting the opposite type.
   */
  async reverseEntry(entryId: string, reason?: string): Promise<void> {
    const entry = await this.prisma.ledgerEntry.findUnique({
      where: { id: entryId },
    });
    if (!entry) throw new BadRequestException('Ledger entry not found');
    if (entry.status === 'REVERSED') throw new BadRequestException('Entry already reversed');

    const wallet = await this.prisma.wallet.findUnique({
      where: { id: entry.walletId },
    });
    if (!wallet) throw new BadRequestException('Wallet not found');

    const walletBalance = new Prisma.Decimal(wallet.balance);
    const entryAmount = new Prisma.Decimal(entry.amount);

    // Apply the reverse: DEBIT reversal = credit, CREDIT reversal = debit
    const newBalance =
      entry.type === 'DEBIT'
        ? walletBalance.plus(entryAmount) // Money returns
        : walletBalance.minus(entryAmount); // Money leaves

    const reverseType = entry.type === 'DEBIT' ? 'CREDIT' : 'DEBIT';

    await this.prisma.$transaction(async (tx) => {
      // Mark original entry as reversed
      await tx.ledgerEntry.update({
        where: { id: entryId },
        data: { status: 'REVERSED' },
      });

      // Create reversal entry
      await tx.ledgerEntry.create({
        data: {
          walletId: entry.walletId,
          type: reverseType,
          amount: entryAmount,
          balance: newBalance,
          status: 'POSTED',
          description: `Reversal: ${reason ?? entry.description}`,
          reference: `REVERSAL:${entryId}`,
          currency: entry.currency,
          transactionId: entry.transactionId,
          transferId: entry.transferId,
        },
      });

      // Update wallet balance
      await tx.wallet.update({
        where: { id: entry.walletId },
        data: { balance: newBalance },
      });
    });
  }

  /**
   * Get ledger entries for a wallet.
   */
  async getWalletLedger(walletId: string, limit = 50, offset = 0) {
    const [entries, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where: { walletId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.ledgerEntry.count({ where: { walletId } }),
    ]);

    return { entries, total };
  }

  /**
   * Verify that a wallet's balance matches its ledger.
   */
  async verifyWalletBalance(walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });
    if (!wallet) throw new BadRequestException('Wallet not found');

    const lastEntry = await this.prisma.ledgerEntry.findFirst({
      where: { walletId, status: 'POSTED' },
      orderBy: { createdAt: 'desc' },
    });

    const walletBalance = new Prisma.Decimal(wallet.balance);
    const ledgerBalance = lastEntry
      ? new Prisma.Decimal(lastEntry.balance)
      : new Prisma.Decimal(0);

    return {
      walletId,
      walletBalance: walletBalance.toString(),
      ledgerBalance: ledgerBalance.toString(),
      isConsistent: walletBalance.equals(ledgerBalance),
      lastEntryDate: lastEntry?.createdAt ?? null,
    };
  }
}
