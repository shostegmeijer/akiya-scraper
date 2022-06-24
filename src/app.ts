import { inakanet, sumai } from "./scrape"

const run = async () => {
    const { INAKANET, SUMAI } = process.env
    INAKANET === "1" && (await inakanet())
    SUMAI === "1" && (await sumai())
}

run()
