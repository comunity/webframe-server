function httpCacheDirectives(cacheControl: string): any {
    return cacheControl && cacheControl.split(',').reduce((acc, curr) => {
        var parts = curr.split('=')
        if (parts.length === 1)
            acc[curr] = true
        else
            acc[parts[0]] = parts[1]
        return acc
    }, {})
}

export = httpCacheDirectives