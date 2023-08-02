
module.exports = {
    routes: [
        {
            method: 'GET',
            path: '/images/upload-url',
            handler: 'images.getUploadUrl'
        }, {
            method: 'GET',
            path: '/images/upload-urls',
            handler: 'images.getUploadUrls'
        }, {
            method: 'POST',
            path: '/images/delete',
            handler: 'images.deleteImages'
        }
    ]
}

