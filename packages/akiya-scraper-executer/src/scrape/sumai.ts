import { bouncingBall } from "cli-spinners"
import ora from "ora"
import Crawler from "crawler"
import $ from "cheerio"
import { PrismaClient } from "@prisma/client"

const host = "akiya.sumai.biz"
// const LISTING = `/archives/bukken/`
// const IMG = `https://${host}/cgi-bin/database/`
// https://akiya.sumai.biz/?bukken=451%EF%BD%9E500%E4%B8%87%E5%86%86&paged=1&so=kak&ord=&s=
const LISTINGS = [
    `https://${host}/?bukken=0%e5%86%86%e7%84%a1%e5%84%9f%e8%ad%b2%e6%b8%a1&so=kak&ord=&s=`, // 0円
    // `https://${host}/?bukken=1%ef%bd%9e50%e4%b8%87%e5%86%86&so=kak&ord=&s=`, // 1～50万円
    // `https://${host}/?bukken=51%ef%bd%9e100%e4%b8%87%e5%86%86&so=kak&ord=&s=`, // 51～100万円
    // `https://${host}/?bukken=101%ef%bd%9e150%e4%b8%87%e5%86%86&so=kak&ord=&s=`, // 101～150万円
    // `https://${host}/?bukken=151%ef%bd%9e200%e4%b8%87%e5%86%86&so=kak&ord=&s=`, // 151～200万円
    // `https://${host}/?bukken=201%ef%bd%9e250%e4%b8%87%e5%86%86&so=kak&ord=&s=`, // 201～250万円
    // `https://${host}/?bukken=251%ef%bd%9e300%e4%b8%87%e5%86%86&so=kak&ord=&s=`, // 251～300万円
    // `https://${host}/?bukken=301%ef%bd%9e350%e4%b8%87%e5%86%86&so=kak&ord=&s=`, // 301～350万円
    // `https://${host}/?bukken=351%ef%bd%9e400%e4%b8%87%e5%86%86&so=kak&ord=&s=`, // 351～400万円
    // `https://${host}/?bukken=401%ef%bd%9e450%e4%b8%87%e5%86%86&so=kak&ord=&s=`, // 401～450万円
    // `https://${host}/?bukken=451%ef%bd%9e500%e4%b8%87%e5%86%86&so=kak&ord=&s=`, // 451～500万円
    // `https://${host}/?bukken=501%e4%b8%87%e5%86%86%ef%bd%9e&so=kak&ord=&s=`, // 501万円～
]

const listingPageUrl = (listingUrl: typeof LISTINGS[number], page = 1) =>
    `${listingUrl}&paged=${page}`

const prisma = new PrismaClient()

const crawler = new Crawler({})

const scrape = async () => {
    const spinner = ora({
        text: "Scraping sumai",
        spinner: bouncingBall,
    }).start()
    // get house pages
    const houseUrls = await getHousesUrls()
    // const urls = (await promises.readFile("sumai.txt")).toString()
    // const houseUrls = urls.split("\n")
    // scrape new houses
    // await scrapeHouses(houseUrls)

    // add houses to database

    // done
    spinner.succeed("done")
    // console.log(houseUrls);
}

const getHousesUrls = async () => {
    let allPages: Crawler.CrawlerRequestResponse[] = []

    await Promise.all(
        LISTINGS.map(async (listing) => {
            const pages = (await getListingPages(listing)) || []
            allPages = [...allPages, ...pages]
        })
    )

    let houseUrls = []

    // // get first page to get total
    // const firstPage = load(await getListing())
    // const total = parseInt(firstPage(".style1").first().text())
    // // get all pages
    // const totalPages = Math.ceil(total / 50)
    // let pages = [firstPage]
    // for (let i = 2; i <= totalPages; i++) {
    //     pages = [...pages, load(await getListing(i))]
    // }

    // let houseUrls = new Set<string>()
    // pages.forEach((p) => {
    //     p(
    //         'a[href*="http://www.sumai.jp/cgi-bin/database/database.cgi?cmd=j&DataNum="]'
    //     ).each((i, el) => {
    //         houseUrls.add(el.type === "tag" ? el.attribs["href"] : "")
    //     })
    // })

    return [...houseUrls]
}

const getListingPages = async (listing: typeof LISTINGS[number]) => {
    const res = await getListingPage(listing)

    // get number of page
    const pageNumberEls = res.$("#nav-above1 .nav-next a")
    const lastPageEl = pageNumberEls[pageNumberEls.length - 2]
    let lastPage = 1
    if (lastPageEl?.type === "tag") {
        lastPage = parseInt($(lastPageEl).text())
    }
    let toReturn = [res]
    await Promise.all(
        [...Array(lastPage - 1)].map(async (_, index) => {
            const page = await getListingPage(listing, index + 2)
            toReturn = [...toReturn, page]
        })
    )

    return toReturn
}

const getListingPage = async (listing: typeof LISTINGS[number], page = 1) =>
    new Promise<Crawler.CrawlerRequestResponse>((resolve, reject) => {
        crawler.queue({
            url: listingPageUrl(listing, page),
            callback: async (error, res, done) => {
                if (error) {
                    console.log(error)
                    reject(error)
                    done()
                }
                done()
                resolve(res)
            },
        })
    })

// const scrapeHouses = async (urls: string[], onlyNew = true) => {
//     // check if house already exists in DB
//     const existingHouses = await prisma.house.findMany({
//         where: {
//             url: {
//                 in: urls,
//             },
//         },
//     })

//     const filteredUrls = onlyNew
//         ? urls.filter((u) => !existingHouses.find((eh) => eh.url === u))
//         : urls

//     console.log("\nscraping new houses:")
//     console.log(filteredUrls)
//     // scrape everything else
//     await Promise.all(
//         filteredUrls.map(async (url) => {
//             await scrapeHouse(url)
//         })
//     )
// }

// const scrapeHouse = async (url: string) =>
//     new Promise<House>((resolve) => {
//         crawler.queue({
//             url,
//             callback: async (
//                 error: Error,
//                 res: Crawler.CrawlerRequestResponse,
//                 done: () => void
//             ) => {
//                 if (error) {
//                     console.log(error)
//                     done()
//                 }

//                 // scrape images
//                 let imageUrls: House["imageUrls"] = []
//                 res.$(".cover img").each((i, el) => {
//                     if (el.type === "tag") {
//                         imageUrls = [...imageUrls, el.attribs["src"]]
//                     }
//                 })
//                 // remove icons
//                 imageUrls = imageUrls.filter((img) => img.indexOf(".gif") < 0)
//                 imageUrls = imageUrls.map((img) => img.replace("./", IMG))

//                 // scrape location
//                 const location: House["location"] = res
//                     .$('.databody th:contains("所在地") + td')
//                     .text()
//                     .trim()

//                 // scrape price
//                 const price: House["price"] = parseJapaneseNumber(
//                     res.$('th:contains("価格") + td').text()
//                 )

//                 // scrape plot size
//                 const plotSize: House["plotSize"] =
//                     extractNumbers(
//                         res.$('th:contains("地積") + td').text()
//                     )?.[0] || undefined

//                 // scrape house size
//                 const houseSize: House["houseSize"] =
//                     extractNumbers(
//                         res.$('th:contains("延床面積") + td').text()
//                     )?.[0] || undefined

//                 const result = await prisma.house.create({
//                     data: {
//                         url,
//                         imageUrls,
//                         location,
//                         plotSize,
//                         houseSize,
//                         price,
//                         website: "SUMAI",
//                     },
//                 })

//                 resolve(result)
//                 done()
//             },
//         })
//     })

// const getSitemap = async () => {
//     const data = await fetch(SITEMAP)
//     const text = await data.text()
//     const parser = new XMLParser()
//     const xml: { urlset: { url: Url[] } } = parser.parse(text)
//     return xml.urlset.url
// }

export default scrape
