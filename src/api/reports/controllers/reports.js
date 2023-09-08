const neo4j = require('neo4j-driver')
const { dbBugReportRole, dbSuggestionReportRole } = require('../../../utils/Constants')

// replace with prod pass -> adminadmin
const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'adminadmin'))

module.exports = {
    createBugReport: async (ctx) => {
        const { createdById, platform, appVersion, bugDescription, severity, reproducibility } = ctx.request.body

        const hasError = false

        const session = driver.session()

        await session.run(
            `Create (n:${dbBugReportRole} {
                createdById: $createdById, platform: $platform, appVersion: $appVersion, bugDescription: $bugDescription,
                severity: $severity, reproducibility: $reproducibility
            })`, {
                createdById, platform, appVersion, bugDescription, severity, reproducibility
            }
        ).catch(err => {
            hasError = true

            return ctx.badRequest('Database error', { error: err })
        })

        
        if (!hasError) {
            ctx.body = {}
        }

        await session.close()
    },

    createSuggestion: async (ctx) => {
        const { createdById, description, category, priority, platform, title } = ctx.request.body
        const hasError = false

        const session = driver.session()
        
        await session.run(
            `Create (n:${dbSuggestionReportRole} {
                createdById: $createdById, description: $description, category: $category, priority: $priority,
                platform: $platform, title: $title
            })`, {
                createdById, description, category, priority, platform, title
            }
        ).catch(err => {
            hasError = true

            return ctx.badRequest('Database error', { error: err })
        })

        
        if (!hasError) {
            ctx.body = {}
        }

        await session.close()
    }
}
