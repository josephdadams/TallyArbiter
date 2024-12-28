import { User } from './User'

export interface AuthenticateSuccessResponse {
	access_token: string
	user: User
}
