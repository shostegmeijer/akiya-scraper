import { bouncingBall } from "cli-spinners"
import ora from "ora"
import Crawler from "crawler"
import axios from "axios"
import { XMLParser } from "fast-xml-parser"
import iconv from "iconv-lite"
import fs from "fs"
import http from "http"
import { load } from "cheerio"
import { House } from "@prisma/client"

interface Url {
    loc: string
    lastmod: string
    changefreq: string
    priority: string
}

const host = "www.inakanet.jp"
const SITEMAP = `/sitemap.xml`
const LISTING = `/cgi-bin/database/database.cgi`

const axiosInstance = axios.create({
    responseType: "arraybuffer",
    transformResponse: [
        (data) => {
            const sjis = new Buffer(data, "binary")
            const utf8 = iconv.decode(sjis, "SHIFT_JIS")
            return utf8
        },
        ...(Array.isArray(axios.defaults.transformRequest)
            ? axios.defaults.transformRequest
            : [axios.defaults.transformRequest]),
    ],
})

const scrape = async () => {
    const spinner = ora({
        text: "Scraping inakanet",
        spinner: bouncingBall,
    }).start()
    // get house pages
    const houseUrls = await getHousesUrls()
    // scrape new houses

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

    let houseUrls = []
    pages.forEach((p) => {
        p(
            'a[href*="http://www.inakanet.jp/cgi-bin/database/database.cgi?cmd=j&DataNum="]'
        ).each((i, el) => {
            houseUrls = [
                ...houseUrls,
                el.attributes.find((a) => a.name === "href").value,
            ]
        })
    })

    return houseUrls
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
                    const sjis = new Buffer(chunk, "binary")
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

const scrapeHouses = async (urls: string[]) =>
    urls.map(async (url) => await scrapeHouse(url))

const scrapeHouse = async (url: string) => {}

const getSitemap = async () => {
    const data = await fetch(SITEMAP)
    const text = await data.text()
    const parser = new XMLParser()
    const xml: { urlset: { url: Url[] } } = parser.parse(text)
    return xml.urlset.url
}

export default scrape
