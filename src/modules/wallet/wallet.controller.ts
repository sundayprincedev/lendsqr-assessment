import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response.helper';
import { FundInput, TransferInput, WithdrawInput } from './wallet.types';
import { WalletService } from './wallet.service';

export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  fund = async (req: Request, res: Response): Promise<void> => {
    const result = await this.walletService.fund(req.user!.id, req.body as FundInput);
    sendSuccess(res, result, 'Wallet funded successfully');
  };

  transfer = async (req: Request, res: Response): Promise<void> => {
    const result = await this.walletService.transfer(req.user!.id, req.body as TransferInput);
    sendSuccess(res, result, 'Transfer successful');
  };

  withdraw = async (req: Request, res: Response): Promise<void> => {
    const result = await this.walletService.withdraw(req.user!.id, req.body as WithdrawInput);
    sendSuccess(res, result, 'Withdrawal successful');
  };

  getWallet = async (req: Request, res: Response): Promise<void> => {
    const result = await this.walletService.getWallet(req.user!.id);
    sendSuccess(res, result);
  };

  getBalance = async (req: Request, res: Response): Promise<void> => {
    const result = await this.walletService.getBalance(req.user!.id);
    sendSuccess(res, result);
  };
}
