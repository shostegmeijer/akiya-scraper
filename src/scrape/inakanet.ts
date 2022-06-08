import { bouncingBall } from "cli-spinners"
import ora from "ora"
import Crawler from "crawler"
import { XMLParser } from "fast-xml-parser"
import iconv from "iconv-lite"
import http from "http"
import { load } from "cheerio"
import { House, PrismaClient } from "@prisma/client"
import parseJapaneseNumber from "../utils/parseJapaneseNumber"
import extractNumbers from "../utils/extractNumbers"
import { promises } from "fs"

interface Url {
    loc: string
    lastmod: string
    changefreq: string
    priority: string
}

const host = "www.inakanet.jp"
const SITEMAP = `/sitemap.xml`
const LISTING = `/cgi-bin/database/database.cgi`
const IMG = `http://${host}/cgi-bin/database/`

const prisma = new PrismaClient()

const crawler = new Crawler({})

const scrape = async () => {
    const spinner = ora({
        text: "Scraping inakanet",
        spinner: bouncingBall,
    }).start()
    // get house pages
    const houseUrls = await getHousesUrls()
    // const urls = (await promises.readFile("inakanet.txt")).toString()
    // const houseUrls = urls.split("\n")
    // scrape new houses
    await scrapeHouses(houseUrls)

    // add houses to database

    // done
    spinner.succeed("done")
    // console.log(houseUrls);
}

const getHousesUrls = async () => {
    // get first page to get total
    const firstPage = load(await getListing())
    const total = parseInt(firstPage(".style1").first().text())
    // get all pages
    const totalPages = total / 50
    let pages = [firstPage]
    for (let i = 2; i <= totalPages - 1; i++) {
        pages = [...pages, load(await getListing(i))]
    }

    let houseUrls = new Set<string>()
    pages.forEach((p) => {
        p(
            'a[href*="http://www.inakanet.jp/cgi-bin/database/database.cgi?cmd=j&DataNum="]'
        ).each((i, el) => {
            houseUrls.add(el.type === "tag" ? el.attribs["href"] : "")
        })
    })

    return [...houseUrls]
}

const getListing = async (page = 1, pages = 50) =>
    new Promise<string>((resolve) => {
        const payload = new URLSearchParams()
        payload.set("cmd", "s")
        payload.set("HTML", "default.html")
        payload.set("DataHtml", "Html_Default")
        payload.set("HyojiSu", pages.toString())
        payload.set("Sort", "Num_UpTime")
        payload.set("Sort2", "Num_Rtime")
        payload.set("Tfile", "Data")
        payload.set("page", page.toString())

        const req = http.request(
            {
                host,
                path: LISTING,
                port: "80",
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Content-Length": payload.toString().length,
                },
            },
            (res) => {
                let data = ""
                res.on("data", (chunk) => {
                    const sjis = Buffer.from(chunk, "binary")
                    const utf8 = iconv.decode(sjis, "SHIFT_JIS")
                    data += utf8
                })
                res.on("end", () => {
                    resolve(data)
                })
            }
        )
        req.write(payload.toString())
        req.end()
    })

const scrapeHouses = async (urls: string[], onlyNew = true) => {
    // check if house already exists in DB
    const existingHouses = await prisma.house.findMany({
        where: {
            url: {
                in: urls,
            },
        },
    })

    const filteredUrls = onlyNew
        ? urls.filter((u) => !existingHouses.find((eh) => eh.url === u))
        : urls

    console.log("\nscraping new houses:")
    console.log(filteredUrls)
    // scrape everything else
    await Promise.all(
        filteredUrls.map(async (url) => {
            await scrapeHouse(url)
        })
    )
}

const scrapeHouse = async (url: string) =>
    new Promise<House>((resolve) => {
        crawler.queue({
            url,
            callback: async (
                error: Error,
                res: Crawler.CrawlerRequestResponse,
                done: () => void
            ) => {
                if (error) {
                    console.log(error)
                    done()
                }

                // scrape images
                let imageUrls: House["imageUrls"] = []
                res.$(".cover img").each((i, el) => {
                    if (el.type === "tag") {
                        imageUrls = [...imageUrls, el.attribs["src"]]
                    }
                })
                // remove icons
                imageUrls = imageUrls.filter((img) => img.indexOf(".gif") < 0)
                imageUrls = imageUrls.map((img) => img.replace("./", IMG))

                // scrape location
                const location: House["location"] = res
                    .$('.databody th:contains("所在地") + td')
                    .text()
                    .trim()

                // scrape price
                const price: House["price"] = parseJapaneseNumber(
                    res.$('th:contains("価格") + td').text()
                )

                // scrape plot size
                const plotSize: House["plotSize"] =
                    extractNumbers(
                        res.$('th:contains("地積") + td').text()
                    )?.[0] || undefined

                // scrape house size
                const houseSize: House["houseSize"] =
                    extractNumbers(
                        res.$('th:contains("延床面積") + td').text()
                    )?.[0] || undefined

                const result = await prisma.house.create({
                    data: {
                        url,
                        imageUrls,
                        location,
                        plotSize,
                        houseSize,
                        price,
                        website: "INAKANET",
                    },
                })

                resolve(result)
                done()
            },
        })
    })

const getSitemap = async () => {
    const data = await fetch(SITEMAP)
    const text = await data.text()
    const parser = new XMLParser()
    const xml: { urlset: { url: Url[] } } = parser.parse(text)
    return xml.urlset.url
}

export default scrape
