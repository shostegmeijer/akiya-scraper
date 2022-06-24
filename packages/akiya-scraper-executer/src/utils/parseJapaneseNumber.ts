const parseJapaneseNumber = (priceString: string) =>
    parseInt(priceString?.trim().replace("万", "0000").replace(",", "")) ||
    undefined

export default parseJapaneseNumber
