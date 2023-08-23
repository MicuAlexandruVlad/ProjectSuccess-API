
const aws = require('aws-sdk')
const dotenv = require('dotenv')

const region = 'European Union (Germany)'
const bucketName = 'genesys-file-storage'
const accessKeyId = process.env.S3_ACCESS_KEY_ID
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY

const s3 = new aws.S3({
    accessKeyId,
    secretAccessKey,
    endpoint: process.env.S3_BUCKET_URL,
    s3BucketEndpoint: true,
    signatureVersion: 'v4'
})


module.exports = {
    getUploadUrl: async (ctx) => {
        const { fileName } = ctx.request.query

        const params = {
            Bucket: bucketName,
            Key: fileName,
            Expires: 60,
            ContentType: 'jpg'
        }

        const uploadUrl = await s3.getSignedUrlPromise('putObject', params).catch(err => {
            console.log('getUploadUrl: err -> ', err)
        })

        ctx.body = {
            url: uploadUrl
        }
    },

    getUploadUrls: async (ctx) => {
        let { fileNames } = ctx.request.query

        fileNames = fileNames.split(',')

        const urls = []

        console.log('fileNames ->', fileNames)

        fileNames.forEach(async (element, index) => {
            const params = {
                Bucket: bucketName,
                Key: element,
                Expires: 120,
                ContentType: 'jpg'
            }

            const uploadUrl = await s3.getSignedUrlPromise('putObject', params).catch(err => {
                console.log('getUploadUrls: err -> ', err)
                return ctx.badRequest('AWS error', { error: err })
            })

            urls.push(uploadUrl)

            if (urls.length === fileNames.length) {
                ctx.body = {
                    urls
                }
            }
        })
    },

    deleteImages: async(ctx) => {
        const { imageKeys } = ctx.request.body

        imageKeys.forEach(async (key, index) => {
            await s3.deleteObject({ Bucket: bucketName, Key: key }).promise().catch(err => {
                console.log('delete: err -> ', err)
                return ctx.badRequest('AWS error', { error: err })
            })

            if (index === imageKeys.length - 1) {
                ctx.body = {}
            }
        })
        

        ctx.body = {}
    }
}
