import fs from 'fs';
import promisify from 'promisify-node';

import {open, create} from 'lwip';
import {uploadFile} from 'imgur';
import {AsyncSubject} from 'rx';

const openImage = promisify(open);
const createImage = promisify(create);

/**
 * Creates an image of the board from the given cards using the light-weight
 * image processing library (lwip), then writes the result to a file and
 * uploads it to imgur.
 *
 * @param  {Array} cards      An array of Card objects
 * @param  {Function} upload  A method used to upload the image, defaults to imgur
 * @return {Observable}       An Observable that signals completion with the URL
 */
export function createBoardImage(cards, upload=uploadFile) {
  const subj = new AsyncSubject();
  const imageFiles = cards.map((c) => `resources/${c.toAsciiString()}.png`);

  if (!fs.existsSync('./output')) {
    fs.mkdirSync('./output');
  }

  let makeImage = null;
  switch (cards.length) {
  case 3:
    makeImage = combineThree(imageFiles, './output/flop.png');
    break;
  case 4:
    makeImage = combineThree(imageFiles, './output/flop.png')
      .then((outputFile) => combineTwo([outputFile, imageFiles[3]], './output/turn.png'));
    break;
  case 5:
    makeImage = combineThree(imageFiles, './output/flop.png')
      .then((outputFile) => combineThree([outputFile, imageFiles[3], imageFiles[4]], './output/river.png'));
    break;
  default:
    throw new Error(`Attempted to make board image for ${cards.length} cards.`);
  }

  makeImage
    .then((outputFile) => upload(outputFile))
    .then((result) => {
      subj.onNext(result.data.link);
      subj.onCompleted();
    })
    .catch((err) => subj.onError(err));

  return subj;
}

/**
 * Combines two image files into a single row.
 *
 * @param  {String} [first      The path to the first image
 * @param  {String} second]     The path to the second image
 * @param  {String} outputFile  A file to hold the resulting image
 * @return {Promise}            A Promise to the result
 */
async function combineTwo([first, second], outputFile) {
  const firstImage = await openImage(first);
  const secondImage = await openImage(second);

  const destImage = await createImage(
    firstImage.width() + secondImage.width(),
    firstImage.height(),
    'white'
  );

  await paste(firstImage, destImage, 0, 0);
  await paste(secondImage, destImage, firstImage.width(), 0);
  await writeFile(destImage, outputFile);
}

/**
 * Combines three image files into a single row.
 *
 * @param  {Array} imageFiles   An array of three image files
 * @param  {String} outputFile  A file to hold the resulting image
 * @return {Promise}            A Promise to the result
 */
async function combineThree(imageFiles, outputFile) {
  await combineTwo(imageFiles.slice(0, 2), outputFile);
  await combineTwo([outputFile, imageFiles[2]], outputFile);
}

/**
 * Returns a Promisified version of the `paste` method.
 */
function paste(src, dest, x, y) {
  return new Promise((resolve, reject) => {
    dest.paste(x, y, src, (err, img) => {
      if (!err) {
        resolve(img);
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Returns a Promisified version of the `writeFile` method.
 */
function writeFile(img, outputFile) {
  return new Promise((resolve, reject) => {
    img.writeFile(outputFile, 'png', {compression: 'fast'}, (err) => {
      if (!err) {
        resolve(outputFile);
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Returns a Promisified version of the `toBuffer` method.
 */
function toBuffer(img) { // eslint-disable-line
  return new Promise((resolve, reject) => {
    img.toBuffer('jpg', {quality: 100}, (err, buffer) => {
      if (!err) {
        resolve(buffer);
      } else {
        reject(err);
      }
    });
  });
}
