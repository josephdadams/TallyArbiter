import jwt from 'jsonwebtoken';
import { logger } from "../index";
import { currentConfig } from './config';
import { clone } from "./clone";

import { AuthenticateSuccessResponse } from '../_models/AuthenticateSuccessResponse';

export function authenticate(username: string, password: string): Promise<AuthenticateSuccessResponse> {
    return new Promise<AuthenticateSuccessResponse>((resolve, reject) => {
        console.log(currentConfig.users);
        let userFound = false;
        currentConfig.users.forEach((user_original) => {
            let user = clone(user_original);
            if(username === user.username) {
                userFound = true;
                if(password !== user.password) {
                    reject(new Error('Password is incorrect'));
                }
                delete user["password"];
                jwt.sign({user}, "JWT_PRIVATE_KEY", { expiresIn: '2 days' }, (err, token) => {
                    if(err) { reject(err) }
                    resolve({
                        access_token: token,
                        user: user
                    });
                });
                return true;
            }
        });
        if(!userFound) reject(new Error('User not found'));
    });
}
