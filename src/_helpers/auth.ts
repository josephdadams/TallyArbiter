import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { logger } from '../index'
import { currentConfig, DEFAULT_PASSWORD, SaveConfig } from './config'
import { MIN_PASSWORD_LENGTH } from './passwordPolicy'
import { clone } from './clone'

import { AuthenticateSuccessResponse } from '../_models/AuthenticateSuccessResponse'
import { User } from '../_models/User'

export function hashPassword(password: string): string {
	return bcrypt.hashSync(password, 10)
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
				checkPassword(password, user.password)
					.then((password_valid) => {
						if (!password_valid) {
							reject(new Error('Invalid username or password'))
						} else {
							delete user['password']
							jwt.sign({ user }, currentConfig.security.jwt_private_key, { expiresIn: '2 days' }, (err, token) => {
								if (err) {
									reject(err)
									return
								}
								resolve({
									access_token: token,
									user: user,
								})
							})
							return true
						}
					})
					.catch(reject)
			}
		})
		if (!userFound) reject(new Error('Invalid username or password'))
	})
}

//lets a signed-in user replace their own password. the current password is required
//so that a leaked token on its own cannot lock the real operator out of the account.
export function changeOwnPassword(username: string, current_password: string, new_password: string): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		if (typeof new_password !== 'string' || new_password.length < MIN_PASSWORD_LENGTH) {
			reject(new Error(`Your new password must be at least ${MIN_PASSWORD_LENGTH} characters long.`))
			return
		}
		if (new_password === DEFAULT_PASSWORD) {
			reject(new Error('That is the default password. Please choose a different one.'))
			return
		}
		const index = currentConfig.users.findIndex((user) => user.username === username)
		if (index === -1) {
			reject(new Error('Invalid username or password'))
			return
		}
		if (new_password === current_password) {
			reject(new Error('Your new password must be different from your current one.'))
			return
		}
		checkPassword(current_password, currentConfig.users[index].password)
			.then((password_valid) => {
				if (!password_valid) {
					reject(new Error('Invalid username or password'))
					return
				}
				currentConfig.users[index].password = hashPassword(new_password)
				delete currentConfig.users[index].mustChangePassword
				SaveConfig()
				logger(`User ${username} changed their password.`)
				resolve()
			})
			.catch(reject)
	})
}

//existing installs are not forced to rotate, but we do want to say so on every boot.
//accounts already flagged mustChangePassword are left out: they cannot do anything
//until they rotate, so warning about them as well would just be noise.
export function usersWithDefaultPassword(): Promise<string[]> {
	return Promise.all(
		currentConfig.users.map((user) =>
			user.mustChangePassword
				? Promise.resolve('')
				: checkPassword(DEFAULT_PASSWORD, user.password)
						.then((matches) => (matches ? user.username : ''))
						.catch(() => ''),
		),
	).then((usernames) => usernames.filter((username) => username !== ''))
}

export function validateAccessToken(access_token: string): Promise<User> {
	return new Promise<User>((resolve, reject) => {
		jwt.verify(access_token, currentConfig.security.jwt_private_key, (err, decoded) => {
			if (err) {
				reject(err)
				return
			}
			resolve(decoded.user)
		})
	})
}

export function getUsersList(removePassword = true): User[] {
	let users = clone(currentConfig.users)
	if (removePassword) {
		users.forEach((user) => {
			delete user['password']
		})
	}
	return users
}

export function addUser(user: User): boolean {
	let userFound = false
	currentConfig.users.forEach((user_original) => {
		if (user.username === user_original.username) {
			userFound = true
		}
	})
	if (!userFound) {
		//a caller that has an opinion about the forced change (the first-run seeding in
		//config.ts) sets it explicitly. otherwise, an account handed the password we ship
		//with has to replace it, so a blank password in the add-user form cannot quietly
		//create a second account on '12345'.
		if (user.mustChangePassword === undefined && user.password === DEFAULT_PASSWORD) {
			user.mustChangePassword = true
		}
		if (!user.mustChangePassword) {
			delete user.mustChangePassword
		}
		user.password = hashPassword(user.password)
		currentConfig.users.push(user)
		SaveConfig()
		logger(`Added new user ${user.username}.`)
		return true
	} else {
		return false
	}
}

const BCRYPT_HASH_PATTERN = /^\$2[aby]?\$\d{2}\$/

export function editUser(user: User) {
	let userFound = false
	currentConfig.users.forEach((user_original, index) => {
		if (user.username === user_original.username) {
			userFound = true
			const passwordChanged = !!user.password && !BCRYPT_HASH_PATTERN.test(user.password)
			if (passwordChanged) {
				user.password = hashPassword(user.password)
			} else if (!user.password) {
				//the users list is served without passwords, so an edit that only changes roles
				//arrives with the field missing entirely. the whole record is replaced below, so
				//without this the account is left with no password at all and can never sign in
				//again -- and there is no way back, because it is not the caller's own account.
				user.password = user_original.password
			}
			//the whole record is replaced here, so an edit that does not touch the password
			//(changing roles, say) must not quietly clear a pending forced change
			if (!passwordChanged && user_original.mustChangePassword) {
				user.mustChangePassword = true
			}
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
