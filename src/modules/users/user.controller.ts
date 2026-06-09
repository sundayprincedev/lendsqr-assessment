import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response.helper';
import { LoginInput, RegisterInput } from './user.types';
import { UserService } from './user.service';

export class UserController {
  constructor(private readonly userService: UserService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const result = await this.userService.register(req.body as RegisterInput);

    sendSuccess(res, result, 'Account created successfully', 201);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.userService.login(req.body as LoginInput);

    sendSuccess(res, result, 'Login successful');
  };
}
