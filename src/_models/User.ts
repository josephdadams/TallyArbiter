export interface User {
	username: string
	password?: string
	roles: string
	//set on the users seeded into a brand new config; the user must pick their own
	//password before the account can be used for anything else
	mustChangePassword?: boolean
}
