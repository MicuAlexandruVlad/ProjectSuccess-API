
module.exports = {
    routes: [
        {
            method: 'POST',
            path: '/neo-db/create-user',
            handler: 'neo-db.createUser'
        }, {
            method: 'GET',
            path: '/neo-db/users',
            handler: 'neo-db.getUsers'
        }, {
            method: 'GET',
            path: '/neo-db/user',
            handler: 'neo-db.getUser'
        }, {
            method: 'GET',
            path: '/neo-db/user-by-jid',
            handler: 'neo-db.getUserByJid'
        }, {
            method: 'POST',
            path: '/neo-db/update-user',
            handler: 'neo-db.updateUser'
        }, {
            method: 'POST',
            path: '/neo-db/update-user-matching-query-data',
            handler: 'neo-db.updateUserMatchingQueryData'
        }, {
            method: 'GET',
            path: '/neo-db/matching-user',
            handler: 'neo-db.getMatchingUser'
        }, {
            method: 'GET',
            path: '/neo-db/connected-users',
            handler: 'neo-db.getConnectedUsers'
        }, {
            method: 'POST',
            path: '/neo-db/block-user',
            handler: 'neo-db.blockUser'
        }, {
            method: 'POST',
            path: '/neo-db/report-user',
            handler: 'neo-db.reportUser'
        }, {
            method: 'POST',
            path: '/neo-db/update-push-token',
            handler: 'neo-db.updatePushToken'
        }, {
            method: 'POST',
            path: '/neo-db/update-notifications',
            handler: 'neo-db.updateNotifications'
        }, {
            method: 'POST',
            path: '/neo-db/delete-user',
            handler: 'neo-db.deleteUserData'
        }, {
            method: 'GET',
            path: '/neo-db/keep-alive',
            handler: 'neo-db.keepAlive'
        }
    ]
}

