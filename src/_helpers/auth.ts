import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { logger } from '../index'
import { currentConfig, SaveConfig } from './config'
import { clone } from './clone'

import { AuthenticateSuccessResponse } from '../_models/AuthenticateSuccessResponse'
import { User } from '../_models/User'

export function hashPassword(password: string): Promise<string> {
	return new Promise((resolve, reject) => {
		bcrypt.hash(password, 10, (err, hash) => {
			if (err) {
				reject(err)
			}
			resolve(hash)
		})
	})
}

export function checkPassword(input_password: string, original_password: string): Promise<boolean> {
	return bcrypt.compare(input_password, original_password)
}

export function authenticate(username: string, password: string): Promise<AuthenticateSuccessResponse> {
	return new Promise<AuthenticateSuccessResponse>((resolve, reject) => {
		let userFound = false
		currentConfig.users.forEach((user_original) => {
			let user = clone(user_original)
			if (username === user.username) {
				userFound = true
				checkPassword(password, user.password).then((password_valid) => {
					if (!password_valid) {
						reject(new Error('Password is incorrect'))
					} else {
						delete user['password']
						jwt.sign({ user }, currentConfig.security.jwt_private_key, { expiresIn: '2 days' }, (err, token) => {
							if (err) {
								reject(err)
							}
							resolve({
								access_token: token,
								user: user,
							})
						})
						return true
					}
				})
			}
		})
		if (!userFound) reject(new Error('User not found'))
	})
}

export function validateAccessToken(access_token: string): Promise<User> {
	return new Promise<User>((resolve, reject) => {
		jwt.verify(access_token, currentConfig.security.jwt_private_key, (err, decoded) => {
			if (err) {
				reject(err)
			}
			resolve(decoded.user)
		})
	})
}

export function getUsersList(removePassword = false): User[] {
	let users = clone(currentConfig.users)
	if (removePassword) {
		users.forEach((user) => {
			delete user['password']
		})
	}
	return users
}

export function addUser(user: User): Promise<boolean> {
	return new Promise((resolve, reject) => {
		let userFound = false
		currentConfig.users.forEach((user_original) => {
			if (user.username === user_original.username) {
				userFound = true
			}
		})
		if (!userFound) {
			hashPassword(user.password).then((hashed_password) => {
				user.password = hashed_password
				currentConfig.users.push(user)
				SaveConfig()
				logger(`Added new user ${user.username}.`)
				resolve(true)
			})
		} else {
			reject()
		}
	})
}

export function editUser(user: User) {
	let userFound = false
	currentConfig.users.forEach((user_original, index) => {
		if (user.username === user_original.username) {
			userFound = true
			currentConfig.users[index] = user
		}
	})
	SaveConfig()
	if (userFound) {
		logger(`Edited user ${user.username}.`)
	}
	return userFound
}

export function deleteUser(user: User) {
	currentConfig.users.forEach((user_original, index) => {
		if (user_original.username === user.username) {
			currentConfig.users.splice(index, 1)
			SaveConfig()
			logger(`Deleted user ${user.username}.`)
			return true
		}
	})
	return false
}
