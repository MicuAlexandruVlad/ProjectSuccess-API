
const neo4j = require('neo4j-driver')
const {
    dbUserRole,
    preferredLocationDifferentCountry,
    preferredLocationSameCity,
    preferredLocationSameCountry,
    R_CONNECTED,
    R_BLOCKED,
    R_REPORTED
} = require('../../../utils/Constants')

// replace with prod pass -> adminadmin
const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'adminadmin'))

module.exports = {
    createUser: async (ctx) => {
        const body = ctx.request.body

        const {
            email, firstName, lastName, languages, bio, birthdate, preferredLanguages,
            gender, location, preferredLocation,
            photos, lookingForChat, rating, strapiId, jid, ratingsCount, preferredAgeGap,
            nickname, autoShareOptions
        } = body

        const session = driver.session()
        const result = await session.run(
            `Create (n:USER {
                email: $email, firstName: $firstName, lastName: $lastName, bio: $bio, languages: $languages,
                birthdate: $birthdate, preferredLanguages: $preferredLanguages, gender: $gender,
                city: $city, country: $country, state: $state, preferredLocation: $preferredLocation, photos: $photos,
                lookingForChat: $lookingForChat, rating: $rating, ratingsCount: $ratingsCount, strapiId: $strapiId,
                jid: $jid, preferredAgeGap: $preferredAgeGap, nickname: $nickname, autoShareOptions: $autoShareOptions
            }) return n`, {
                email, firstName, lastName, bio, languages, birthdate,
                preferredLanguages, gender,
                city: location.city, state: location.state, country: location.country, preferredLocation, photos,
                lookingForChat, rating, ratingsCount, strapiId, jid, preferredAgeGap, nickname, autoShareOptions
            }
        )

        await session.close()

        ctx.body = { node: result.records[0] }
    },

    getUsers: async (ctx) => {
        const session = driver.session()
        const result = await session.run('Match(n) Return n')

        const data = result.records

        ctx.body = { res: data }
    },

    getUser: async(ctx) => {
        const { email } = ctx.request.query
        let hasError = false

        const session = driver.session()

        const result = await session.run(`Match(user:${dbUserRole}) where user.email = "${email}" return user`).catch(err => {
            hasError = true

            return ctx.badRequest('Database error', { error: err })
        })
        
        if (!hasError) {
            const node = result.records[0]
            ctx.body = { node }
        }

        await session.close()
    },

    getUserByJid: async(ctx) => {
        const { jid } = ctx.request.query
        let hasError = false

        const session = driver.session()

        const result = await session.run(`Match(user:${dbUserRole}) where user.jid = "${jid}" return user`).catch(err => {
            hasError = true

            return ctx.badRequest('Database error', { error: err })
        })
        
        if (!hasError) {
            const node = result.records[0]
            ctx.body = { node }
        }

        await session.close()
    },

    updateUser: async(ctx) => {
        let { user } = ctx.request.body
        const databaseId = user.neoDbId

        const session = driver.session()

        delete user.neoDbId

        user.last_updated = new Date().getTime()

        const result = await session.run(`MATCH (u: ${dbUserRole}) WHERE id(u) = $databaseId SET u = $user`, {
            databaseId, user
        }).catch(err => {
            hasError = true

            return ctx.badRequest('Database error', { error: err })
        })
        
        ctx.body = {}
        
        await session.close()
    },

    updateUserMatchingQueryData: async (ctx) => {
        let { user } = ctx.request.body
        const databaseId = user.neoDbId
        const requestingUserDbId = user.neoDbId
        const yearInMs = 31556952000

        let hasError = false

        delete user.neoDbId

        const session = driver.session()

        await session.run(`
            MATCH (u: ${dbUserRole})
            WHERE id(u) = $databaseId
            SET u = $user
            SET u.last_updated = timestamp()
        `, {
            databaseId, user
        }).catch(err => {
            hasError = true

            return ctx.badRequest('Database error', { error: err })
        })

        if (user.lookingForChat) {
            const queryData = {
                requestingUserDbId,
                country: user.country,
                city: user.city,
                state: user.state,
                preferredLocation: user.preferredLocation,
                preferredLanguages: user.preferredLanguages.join(','),
                spokenLanguages: user.languages.join(','),
                oldestAge: user.birthdate - user.preferredAgeGap * yearInMs,
                youngestAge: user.birthdate + user.preferredAgeGap * yearInMs,
                requestingUserAge: user.birthdate,
            }

            const result = await module.exports.matchingUserQuery(queryData).catch(err => {
                hasError = true
                
                return ctx.badRequest('Database error', { error: err })
            })

            if (!hasError) {                
                if (result.records.length === 0) {    
                    await session.close()
                    
                    ctx.body = {}
                } else {
                    // matching users found -> set the matched user lookingForChat value to false
                    // create a CONNECTED relationship between the 2 users
                    const node = result.records[0]
                    const matchedUserId = node._fields[0].identity.low

                    await session.run(`
                        MATCH (user1:${dbUserRole}), (user2:${dbUserRole})
                        WHERE ID(user1) = $matchedUserId AND ID(user2) = $requestingUserDbId
                        SET user1.lookingForChat = false, user2.lookingForChat = false
                        CREATE (user1)-[:${R_CONNECTED}]->(user2), (user2)-[:${R_CONNECTED}]->(user1)
                    `, {
                        requestingUserDbId: typeof requestingUserDbId === 'string' ? parseInt(requestingUserDbId) : requestingUserDbId,
                        matchedUserId
                    })
    
                    if (!hasError) {
                        ctx.body = {
                            node
                        }
                    }
    
                    await session.close()
                }
            }
        } else {
            ctx.body = {}
        }
    },

    // TODO: test the query for the blocked or reported users
    matchingUserQuery: (queryData) => {
        return new Promise(async (resolve, reject) => {
            const {
                requestingUserDbId, country, state, city, preferredLocation, oldestAge, youngestAge, requestingUserAge
            } = queryData
            let { preferredLanguages, spokenLanguages } = queryData

            const yearInMs = 31556952000

            preferredLanguages = preferredLanguages.split(',')
            spokenLanguages = spokenLanguages.split(',')
            
            const session = driver.session()
            let query = ''

            if (preferredLocation === preferredLocationSameCity) {
                query = `
                    MATCH (user: ${dbUserRole})
                    WHERE ID(user) = $requestingUserDbId
                    WITH user
                    MATCH(all_users: ${dbUserRole})
                    WHERE ID(all_users) <> $requestingUserDbId
                    AND NOT (user)-[:${R_CONNECTED}]-(all_users)
                    AND NOT (user)-[:${R_BLOCKED}]-(all_users)
                    AND NOT (user)-[:${R_REPORTED}]-(all_users)
                    AND all_users.lookingForChat = true
                    AND all_users.city = $city
                    AND all_users.country = $country
                    AND all_users.state = $state
                    AND (
                        all_users.birthdate >= $oldestAge
                        AND all_users.birthdate <= $youngestAge
                        AND all_users.birthdate - all_users.preferredAgeGap * $yearInMs <= $requestingUserAge
                        AND all_users.birthdate + all_users.preferredAgeGap * $yearInMs >= $requestingUserAge
                    )
                    AND (
                        all_users.preferredLocation = "Same City"
                        OR all_users.preferredLocation = "Same Country"
                        OR all_users.preferredLocation = "No Preference"
                    )
                    AND ANY(lang in all_users.languages WHERE lang in $preferredLanguages)
                    AND ANY(lang in all_users.preferredLanguages WHERE lang in $spokenLanguages)
                    RETURN all_users
                    ORDER BY all_users.rating DESC
                    LIMIT 1
                    `
            } else if (preferredLocation === preferredLocationSameCountry) {
                query = `
                    MATCH (user: ${dbUserRole})
                    WHERE ID(user) = $requestingUserDbId
                    WITH user
                    MATCH(all_users: ${dbUserRole})
                    WHERE ID(all_users) <> $requestingUserDbId
                    AND NOT (user)-[:${R_CONNECTED}]-(all_users)
                    AND NOT (user)-[:${R_BLOCKED}]-(all_users)
                    AND NOT (user)-[:${R_REPORTED}]-(all_users)
                    AND all_users.lookingForChat = true
                    AND all_users.country = $country
                    AND (
                        all_users.preferredLocation = "Same Country"
                        OR (
                            all_users.preferredLocation = "Same City"
                            AND all_users.city = $city
                            AND all_users.state = $state
                        )
                        OR all_users.preferredLocation = "No Preference"
                    )
                    AND ANY(lang in all_users.languages WHERE lang in $preferredLanguages)
                    AND ANY(lang in all_users.preferredLanguages WHERE lang in $spokenLanguages)
                    RETURN all_users
                    ORDER BY all_users.rating DESC
                    LIMIT 1
                `
            } else {
                query = `
                    MATCH (user: ${dbUserRole})
                    WHERE ID(user) = $requestingUserDbId
                    WITH user
                    MATCH(all_users: ${dbUserRole})
                    WHERE ID(all_users) <> $requestingUserDbId
                    AND NOT (user)-[:${R_CONNECTED}]-(all_users)
                    AND NOT (user)-[:${R_BLOCKED}]-(all_users)
                    AND NOT (user)-[:${R_REPORTED}]-(all_users)
                    AND all_users.lookingForChat = true
                    AND all_users.country <> $country
                    AND (
                        all_users.birthdate >= $oldestAge
                        AND all_users.birthdate <= $youngestAge
                        AND all_users.birthdate - all_users.preferredAgeGap * $yearInMs <= $requestingUserAge
                        AND all_users.birthdate + all_users.preferredAgeGap * $yearInMs >= $requestingUserAge
                    )
                    AND (
                        all_users.preferredLocation = "Different Country"
                        OR all_users.preferredLocation = "No Preference"
                    )
                    AND ANY(lang in all_users.languages WHERE lang in $preferredLanguages)
                    AND ANY(lang in all_users.preferredLanguages WHERE lang in $spokenLanguages)
                    RETURN all_users
                    ORDER BY all_users.rating DESC
                    LIMIT 1
                `
            }

            const result = await session.run(query, {
                requestingUserDbId: typeof requestingUserDbId === 'string' ? parseInt(requestingUserDbId) : requestingUserDbId,
                state, country, city, preferredLanguages, spokenLanguages, youngestAge, oldestAge, yearInMs,
                requestingUserAge: typeof requestingUserAge === 'string' ? parseInt(requestingUserAge) : requestingUserAge
            }).catch(err => {
                reject(err)
                return
            })

            resolve(result)

            await session.close()
        })
    },

    getMatchingUser: async (ctx) => {
        const { requestingUserDbId } = ctx.request.query
        
        let hasError = false
        
        const result = await module.exports.matchingUserQuery(ctx.request.query).catch(err => {
            hasError = true
            
            return ctx.badRequest('Database error', { error: err })
        })

        if (!hasError) {
            const session = driver.session()
            
            if (result.records.length === 0) {
                console.log('getMatchingUser: no matching users found')
                // no matching users found -> update current user lookingForChat to true

                await session.run(`
                    MATCH (user: ${dbUserRole})
                    WHERE ID(user) = $requestingUserDbId
                    SET user.lookingForChat = true
                `, {
                    requestingUserDbId: parseInt(requestingUserDbId)
                })

                await session.close()
                
                ctx.body = {}

            } else {
                // matching users found -> set the matched user lookingForChat value to false
                // create a CONNECTED relationship between the 2 users
                const node = result.records[0]
                const matchedUserId = node._fields[0].identity.low

                await session.run(`
                    MATCH (user1)
                    WHERE id(user1) = $requestingUserDbId
                    OPTIONAL MATCH (user2:${dbUserRole})
                    WHERE id(user2) = $matchedUserId
                    SET user2.lookingForChat = false
                    MERGE (user1)-[r1:${R_CONNECTED}]->(user2)
                    SET r1.timestamp = timestamp()
                    MERGE(user2)-[r2:${R_CONNECTED}]->(user1)
                    SET r2.timestamp = timestamp()
                `, {
                    matchedUserId, requestingUserDbId: parseInt(requestingUserDbId)
                }).catch(err => {
                    hasError = true
                    
                    return ctx.badRequest('Database error', { error: err })
                })

                if (!hasError) {
                    ctx.body = {
                        node
                    }
                }

                await session.close()
            }
        }
    },

    getConnectedUsers: async (ctx) => {
        let { requestingUserDbId, lastTimestamp } = ctx.request.query

        requestingUserDbId = parseInt(requestingUserDbId)
        lastTimestamp = parseInt(lastTimestamp)

        const session = driver.session()

        const result = await session.run(`
            MATCH (user:${dbUserRole}) WHERE id(user) = $requestingUserDbId
            MATCH (user)-[r:${R_CONNECTED}]->(connected_user:${dbUserRole})
            WHERE connected_user.last_updated > $lastTimestamp
            OR r.timestamp > $lastTimestamp
            RETURN connected_user
        `, {
            requestingUserDbId, lastTimestamp
        })

        const nodes = result.records
        
        nodes.length ?
            ctx.body = { nodes }
            :
            ctx.body = {}
    },

    blockUser: async (ctx) => {
        const { requestingUserDbId, blockedUserDbId } = ctx.request.body
        let hasError = false

        const session = driver.session()

        await session.run(`
            MATCH (user:${dbUserRole}) WHERE id(user) = $requestingUserDbId
            MATCH (blocked_user:${dbUserRole}) WHERE id(blocked_user) = $blockedUserDbId
            MATCH (user)-[connected:${R_CONNECTED}]-(blocked_user)
            DELETE connected
            MERGE (user)-[r:${R_BLOCKED}]->(blocked_user)
            SET r.timestamp = timestamp()
            SET blocked_user.rating = blocked_user.rating - 5
        `, {
            requestingUserDbId: parseInt(requestingUserDbId), blockedUserDbId: parseInt(blockedUserDbId)
        }).catch(err => {
            hasError = true
                    
            return ctx.badRequest('Database error', { error: err })
        })

        if (!hasError) {
            ctx.body = {}
        }

        await session.close()
    },

    reportUser: async (ctx) => {
        const { requestingUserDbId, reportedUserDbId, reason } = ctx.request.body
        let hasError = false

        const session = driver.session()

        await session.run(`
            MATCH (user:${dbUserRole}) WHERE id(user) = $requestingUserDbId
            MATCH (reported_user:${dbUserRole}) WHERE id(reported_user) = $reportedUserDbId
            MATCH (user)-[connected:${R_CONNECTED}]-(reported_user)
            DELETE connected
            MERGE (user)-[r:${R_REPORTED}]->(reported_user)
            SET r.timestamp = timestamp()
            SET r.reason = $reason
            SET reported_user.rating = reported_user.rating - 10
        `, {
            requestingUserDbId: parseInt(requestingUserDbId), reportedUserDbId: parseInt(reportedUserDbId),
            reason
        }).catch(err => {
            hasError = true
                    
            return ctx.badRequest('Database error', { error: err })
        })

        if (!hasError) {
            ctx.body = {}
        }

        await session.close()
    },

    async updatePushToken (ctx) {
        const { accountId, pushToken } = ctx.request.body.data

        const session = driver.session()
        const time = new Date().getTime()

        // maybe store the fcm key on the server in .env and send it back to the user whenever they update their push token
        // this way would be more safe rather than holding the fcm key hardcoded in the constants file
        await session.run(`
            MATCH (user:${dbUserRole})
            WHERE user.strapiId = $accountId
            SET user.pushToken = $pushToken
            SET user.last_updated = $time
        `, {
            accountId, pushToken, time
        }).catch(err => {
            return ctx.badRequest('Database error', { error: err })
        })

        await session.close()

        ctx.body = {
            fcmServerKey: process.env.FCM_SERVER_KEY
        }
    },

    async updateNotifications (ctx) {
        const { accountId, notificationsEnabled } = ctx.request.body.data

        const session = driver.session()
        const time = new Date().getTime()

        await session.run(`
            MATCH (user:${dbUserRole})
            WHERE user.strapiId = $accountId
            SET user.notificationsEnabled = $notificationsEnabled
            SET user.last_updated = $time
        `, {
            accountId, notificationsEnabled, time
        }).catch(err => {
            return ctx.badRequest('Database error', { error: err })
        })

        await session.close()

        ctx.body = {}
    },

    async deleteUserData (ctx) {
        const { databaseId } = ctx.request.body.data

        const session = driver.session()

        await session.run(`
            MATCH (user:${dbUserRole})
            WHERE ID(user) = $databaseId
            DETACH DELETE user
        `, {
            databaseId
        }).catch(err => {
            return ctx.badRequest('Database error', { error: err })
        })

        await session.close()

        ctx.body = {}
    },

    async keepAlive (ctx) {
        const session = driver.session()

        await session.run(`
            MATCH (user:${dbUserRole})
            RETURN user
        `).catch(err => {
            return ctx.badRequest('Database error', { error: err })
        })

        await session.close()

        ctx.body = {}
    },

    async getAll (ctx) {
        const session = driver.session()

        const res = await session.run(`
            MATCH (user:${dbUserRole})
            RETURN user
        `).catch(err => {
            return ctx.badRequest('Database error', { error: err })
        })

        await session.close()

        ctx.body = {
            data: res.records
        }
    },
}
