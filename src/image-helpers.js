const fs = require('fs');
const rx = require('rx');
const lwip = require('lwip');
const imgur = require('imgur');
const promisify = require('promisify-node');

const openImage = promisify(lwip.open);
const createImage = promisify(lwip.create);

class ImageHelpers {

  // Public: Creates an image of the board from the given cards using the
  // light-weight image processing library (`lwip`), then writes the result to
  // a file and uploads it to `imgur`.
  //
  // imageFiles - An array of three image files
  // outputFile - The file where the result will be saved
  // upload - (Optional) Defaults to `imgur`, but can be overridden for testing
  //
  // Returns an {Observable} that will `onNext` with the URL of the combined
  // image, or `onError` if anything goes wrong
  static createBoardImage(cards, upload=imgur.uploadFile) {
    let subj = new rx.AsyncSubject();
    let imageFiles = cards.map((c) => `resources/${c.toAsciiString()}.png`);

    if (!fs.existsSync('./output')) {
      fs.mkdirSync('./output');
    }

    let makeImage = null;
    switch (cards.length) {
    case 3:
      makeImage = ImageHelpers.combineThree(imageFiles, './output/flop.png');
      break;
    case 4:
      makeImage = ImageHelpers.combineThree(imageFiles, './output/flop.png')
        .then((outputFile) => ImageHelpers.combineTwo([outputFile, imageFiles[3]], './output/turn.png'));
      break;
    case 5:
      makeImage = ImageHelpers.combineThree(imageFiles, './output/flop.png')
        .then((outputFile) => ImageHelpers.combineThree([outputFile, imageFiles[3], imageFiles[4]], './output/river.png'));
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

  // Private: Combines two image files into a single row
  //
  // imageFiles - An array of two image files
  // outputFile - The file where the result will be saved
  //
  // Returns a {Promise} of the resulting file
  static combineTwo(imageFiles, outputFile) {
    let images = [];

    return openImage(imageFiles[0])
      .then((firstImage) => {
        images.push(firstImage);
        return openImage(imageFiles[1]);
      })
      .then((secondImage) => {
        images.push(secondImage);
        return createImage(images[0].width() + images[1].width(), images[0].height(), 'white');
      })
      .then((destImage) => ImageHelpers.paste(images[0], destImage, 0, 0))
      .then((destImage) => ImageHelpers.paste(images[1], destImage, images[0].width(), 0))
      .then((destImage) => ImageHelpers.writeFile(destImage, outputFile));
  }

  // Private: Combines three images files into a single row, using the
  // `combineTwo` sequentially
  //
  // imageFiles - An array of three image files
  // outputFile - The file where the result will be saved
  //
  // Returns a {Promise} of the resulting file
  static combineThree(imageFiles, outputFile) {
    return ImageHelpers.combineTwo(imageFiles.slice(0, 2), outputFile)
      .then(() => ImageHelpers.combineTwo([outputFile, imageFiles[2]], outputFile));
  }

  // Private: Returns a Promisified version of the `paste` method
  //
  // src - The image to paste
  // dest - The target image for the paste operation
  // x - The x-coordinate of the paste
  // y - The y-coordinate of the paste
  //
  // Returns a {Promise} of the resulting image
  static paste(src, dest, x, y) {
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

  // Private: Returns a Promisified version of the `writeFile` method
  //
  // img - The image to write
  // outputFile - The output file path
  //
  // Returns a {Promise} indicating completion
  static writeFile(img, outputFile) {
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

  // Private: Returns a Promisified version of the `toBuffer` method
  //
  // img - The image to convert
  //
  // Returns a {Promise} of the {Buffer}, encoded as a jpeg
  static toBuffer(img) {
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
}

module.exports = ImageHelpers;
