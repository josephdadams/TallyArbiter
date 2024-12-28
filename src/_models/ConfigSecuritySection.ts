export interface ConfigSecuritySection {
	jwt_private_key: string

	//here for compatibility with old config
	username_settings?: string
	password_settings?: string
	username_producer?: string
	password_producer?: string
}
