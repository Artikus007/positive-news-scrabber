const { utils } = require('apify');
const Apify = require('apify');

// Apify.utils contains various utilities, e.g. for logging.
// Here we use debug level of logging to improve the debugging experience.
// This functionality is optional!
const { log } = Apify.utils;
log.setLevel(log.LEVELS.DEBUG);

const START_URL = 'https://www.positive.news/articles/'

const handleSinglePages = async (urls) => {
    const requestList = await Apify.openRequestList("single-pages", urls); 

    const crawler = new Apify.CheerioCrawler({
        requestList,
        minConcurrency: 10,
        maxConcurrency: 50,
        maxRequestRetries: 1,
        handlePageTimeoutSecs: 30,
        maxRequestsPerCrawl: 10,
        handlePageFunction: async ({ request, $ }) => { 
            const { url  } = request; 
            const result = {
                sourceUrl: url,
            } 
            
            result.image = $('img.featured__image').first()['0'].attribs.src
            result.title = $('h1').first().text()
            result.date = $('.article__date').first().text()
            
            result.data = []

            $('div.article__content').children('div').each((_, el)=> {
                const attr = el.attribs.class
                if(attr.includes("text__block")){
                
                    $(el).children('h4').each((_, childEl)=> {
                        result.data.push({
                            type: "text_bold",
                            text: $(childEl).text()
                        })
                    })

                    $(el).children('p').each((_, childEl)=> {
                        result.data.push({
                            type: "text",
                            text: $(childEl).text()
                        })
                    })

                } else if(attr.includes("intro__paragraph")) {
                
                    $(el).children('p').each((_, childEl)=> {
                        result.data.push({
                            type: "text_bold",
                            text: $(childEl).text()
                        })
                    })

                } else if(attr.includes("image__block")) {
                    const image = {
                        type: "image"
                    }
                    $(el).children('img').each((_, childEl)=> {
                        image.image = childEl.attribs.src
                    })
                
                    $(el).children('p').each((_, childEl)=> {
                        image.text = $(childEl).text()?.trim()
                    })
                    if(image.image){
                        result.data.push(image)
                    }
                }
            })
            console.log(result)
            await Apify.pushData(result);
        },
        handleFailedRequestFunction: async ({ request }) => {
            log.debug(`Request ${request.url} failed twice.`);
        },
    });

    await crawler.run();
}

Apify.main(async () => {
    const input = await Apify.getInput();
    const list = input && input.startUrls && input.startUrls.length > 0 ? input.startUrls : [{ url: START_URL }];
    const requestList = await Apify.openRequestList("list-pages", list); 

    const crawler = new Apify.CheerioCrawler({
        requestList,
        minConcurrency: 10,
        maxConcurrency: 50,
        maxRequestRetries: 1,
        handlePageTimeoutSecs: 60,
        maxRequestsPerCrawl: 10,
        handlePageFunction: async ({ $ }) => { 
            const urls = []
            $('a.card__image__link').each((_, el) => {
                urls.push({ url: el.attribs.href });
            });
            await handleSinglePages(urls)
        },
        handleFailedRequestFunction: async ({ request }) => {
            log.debug(`Request ${request.url} failed twice.`);
        },
    });

    await crawler.run();

    log.debug('Crawler finished.');
});