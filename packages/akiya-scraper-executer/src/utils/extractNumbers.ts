import parseJapaneseNumber from "./parseJapaneseNumber"

const extractNumbers = (string: string) =>
    /\d+(,\d+)?/
        .exec(string)
        ?.map((stringNumber) => parseJapaneseNumber(stringNumber)) || undefined

export default extractNumbers
