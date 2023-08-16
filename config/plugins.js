module.exports = ({ env }) => ({
    'users-permissions': {
		config: {
			jwt: {
				expiresIn: '9999999d',
			},
		},
    },
    email: {
        config: {
            provider: 'nodemailer',
            providerOptions: {
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL,
                    pass: process.env.GMAIL_APP_PASS
                }
                // ... any custom nodemailer options
            },
            settings: {
                defaultFrom: process.env.EMAIL,
                defaultReplyTo: process.env.EMAIL,
            },
        },
    },
})