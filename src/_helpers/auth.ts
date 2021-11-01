import jwt from 'jsonwebtoken';
import { logger } from "../index";
import { currentConfig } from './config';
import { clone } from "./clone";

import { AuthenticateSuccessResponse } from '../_models/AuthenticateSuccessResponse';
import { User } from '../_models/User';

export function authenticate(username: string, password: string): Promise<AuthenticateSuccessResponse> {
    return new Promise<AuthenticateSuccessResponse>((resolve, reject) => {
        let userFound = false;
        currentConfig.users.forEach((user_original) => {
            let user = clone(user_original);
            if(username === user.username) {
                userFound = true;
                if(password !== user.password) {
                    reject(new Error('Password is incorrect'));
                }
                delete user["password"];
                jwt.sign({user}, currentConfig.security.jwt_private_key, { expiresIn: '2 days' }, (err, token) => {
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

export function validateAccessToken(access_token: string): Promise<User> {
    return new Promise<User>((resolve, reject) => {
        jwt.verify(access_token, currentConfig.security.jwt_private_key, (err, decoded) => {
            if(err) {
                reject(err);
            }
            resolve(decoded.user);
        });
    });
}

export function getUsersList(removePassword = false): User[] {
    let users = clone(currentConfig.users);
    if(removePassword) {
        users.forEach((user) => {
            delete user["password"];
        });
    }
    return users;
}

export function addUser(user: User) {
    let userFound = false;
    currentConfig.users.forEach((user_original) => {
        if(user.username === user_original.username) {
            userFound = true;
            return false;
        }
    });
    if(!userFound) {
        currentConfig.users.push(user);
        return true;
    }
}

export function editUser(user: User) {
    let userFound = false;
    currentConfig.users.forEach((user_original, index) => {
        if(user.username === user_original.username) {
            userFound = true;
            currentConfig.users[index] = user;
        }
    });
    return userFound;
}

export function deleteUser(user: User) {
    let userFound = false;
    currentConfig.users.forEach((user_original, index) => {
        if(user_original.username === user.username) {
            userFound = true;
            currentConfig.users.splice(index, 1);
            return true;
        }
    });
    return userFound;
}
