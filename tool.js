const crypto = require('crypto')
const os = require('os')
const delay = ms => new Promise(res => setTimeout(res, ms))
const { customAlphabet } = require('nanoid')

var idGenerate = customAlphabet('23456789abcdefghijkmnpqrstuvwxyzABCDEFGHIJKLMNPQRSTUVWXYZ', 9) //=> "4f9Dd1A42"

function encrypt(text, word){
  var cipher = crypto.createCipher('aes-256-cbc', word)
  var crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex')
  return crypted
}

function decrypt(text, word){
  var decipher = crypto.createDecipher('aes-256-cbc', word)
  var dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8')
  return dec
}

function createWord() {
  let word = []
  word[0] = 't'
  word[1] = 'i'
  word[2] = '2'
  word[3] = '6'
  word[4] = 'w'
  return 'd'.concat(word[0], word[1], word[2], word[3], word[4])
}

let buf2obj = buf => {
  return JSON.parse(decrypt(buf.toString(), createWord())) // {msgType:xxx, data:{xxx}}
}

let obj2buf = obj => {
  return Buffer.from(encrypt(JSON.stringify(obj), createWord()))
}

let encodeIdBuf = (id, buf) => { // id: integer 0-255, buf: Buffer,  return a Uint8Array
  let id_uint8array = new Uint8Array([id])
  let buf_uint8array = new Uint8Array(buf)
  let combined_uint8array = new Uint8Array([...id_uint8array, ...buf_uint8array])
  // return combined_uint8array.buffer // ArrayBuffer
  return combined_uint8array
}

let decodeIdBuf = (buf) => { // buf: an Buffer/Uint8Array, return id: integer, buf: Buffer
  // console.log(`buf:${JSON.stringify(buf)}, buf.length:${buf.length}`)
  let combined_uint8array = new Uint8Array(buf.buffer) // view in Uint8Array
  let id = combined_uint8array[0]
  let buf_uint8array= new Uint8Array(buf.buffer, 1, buf.length - 1)
  // console.log(`buf_uint8array:${buf_uint8array}, whole buf:${buf}`)
  return {id, buf:new Buffer.from(buf_uint8array.buffer, 1)} // have to use offset=1
}

let getLocalIPs = () => {
  const ifaces = os.networkInterfaces()
  let addresses = []

  Object.keys(ifaces).forEach(dev => {
    ifaces[dev].filter(details => {
      if (details.family === 'IPv4' && details.internal === false) {
        addresses.push(details.address)
      }
    })
  })
  return addresses
}

module.exports = { idGenerate, delay, encrypt, decrypt, createWord, buf2obj, obj2buf, encodeIdBuf, decodeIdBuf, getLocalIPs }
