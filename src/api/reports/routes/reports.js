
module.exports = {
    routes: [
        {
            method: 'POST',
            path: '/reports/upload-bug-report',
            handler: 'reports.createBugReport'
        },
        {
            method: 'POST',
            path: '/reports/upload-suggestion',
            handler: 'reports.createSuggestion'
        },
    ]
}

