import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import { SocketService } from './socket.service'
import { jwtDecode } from 'jwt-decode'
import { roles } from '../../../../src/_helpers/authRoles'

export interface LoginResponse {
	loginOk: boolean
	message: string
	accessToken: string
}

@Injectable({
	providedIn: 'root',
})
export class AuthService {
	public access_token: string = ''
	public profile: any = undefined
	public roles: string[] = []

	constructor(
		private socketService: SocketService,
		private router: Router,
	) {
		if (localStorage.getItem('access_token') !== null) {
			this.access_token = localStorage.getItem('access_token') as string
			this.loadProfile()
			this.socketService.sendAccessToken(this.access_token)
		}
		this.roles = roles
	}

	private setToken(value: string) {
		localStorage.setItem('access_token', value)
		this.access_token = value
		this.loadProfile()
		this.socketService.sendAccessToken(this.access_token)
	}

	private removeToken() {
		localStorage.removeItem('access_token')
		this.access_token = ''
	}

	public loadProfile() {
		let now = Date.now().valueOf() / 1000
		let decoded: any = jwtDecode(this.access_token)
		if (typeof decoded.exp !== 'undefined' && decoded.exp < now) {
			return false
		}
		if (typeof decoded.nbf !== 'undefined' && decoded.nbf > now) {
			return false
		}
		this.profile = decoded.user
		return true
	}

	public login(username: string, password: string) {
		return new Promise<LoginResponse>((resolve) => {
			this.socketService.socket.emit('login', username, password)
			this.socketService.socket.once('login_response', (response: LoginResponse) => {
				if (response.loginOk === true) {
					this.setToken(response.accessToken)
				}
				resolve(response)
			})
		})
	}

	public logout(routerDestination: string[] | null = null) {
		this.removeToken()
		this.profile = undefined
		if (routerDestination === null) {
			routerDestination = ['home']
		}
		this.router.navigate(routerDestination)
	}

	public requireRole(role: string) {
		if (this.profile === undefined) return false
		if (this.profile.roles.includes('admin')) return true
		if (!this.profile.roles.includes(role)) return false
		return true
	}
}
