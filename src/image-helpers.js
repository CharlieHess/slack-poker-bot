const fs = require('fs');
const rx = require('rx');
const jimp = require('jimp');
const imgur = require('imgur');
const promisify = require('promisify-node');

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
  static createBoardImage(cards, upload = imgur.uploadFile) {
    let subj = new rx.AsyncSubject();
    let imageFiles = cards.map(c => `resources/${c.toAsciiString()}.png`);

    if (!fs.existsSync('./output')) {
      fs.mkdirSync('./output');
    }

    let makeImage = null;
    let imagePath = null;
    switch (cards.length) {
      case 3:
        makeImage = ImageHelpers.combineThree(imageFiles, './output/flop.png');
        imagePath = './output/flop.png';
        break;
      case 4:
        makeImage = ImageHelpers.combineThree(
          imageFiles,
          './output/flop.png',
        ).then(outputFile =>
          ImageHelpers.combineTwo(
            [outputFile, imageFiles[3]],
            './output/turn.png',
          ),
        );
        imagePath = './output/turn.png';
        break;
      case 5:
        makeImage = ImageHelpers.combineThree(
          imageFiles,
          './output/flop.png',
        ).then(outputFile =>
          ImageHelpers.combineThree(
            [outputFile, imageFiles[3], imageFiles[4]],
            './output/river.png',
          ),
        );
        imagePath = './output/river.png';
        break;
      default:
        throw new Error(
          `Attempted to make board image for ${cards.length} cards.`,
        );
    }

    makeImage
      .then(outputFile => upload(imagePath))
      .then(result => {
        subj.onNext(result.data.link);
        subj.onCompleted();
      })
      .catch(err => subj.onError(err));

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

    return jimp
      .read(imageFiles[0])
      .then(firstImage => {
        images.push(firstImage);
        return jimp.read(imageFiles[1]);
      })
      .then(secondImage => {
        images.push(secondImage);
        return new jimp(
          images[0].bitmap.width + images[1].bitmap.width,
          images[0].bitmap.height,
        );
      })
      .then(destImage => destImage.composite(images[0], 0, 0))
      .then(destImage =>
        destImage.composite(images[1], images[0].bitmap.width, 0),
      )
      .then(destImage => destImage.write(outputFile));
  }

  // Private: Combines three images files into a single row, using the
  // `combineTwo` sequentially
  //
  // imageFiles - An array of three image files
  // outputFile - The file where the result will be saved
  //
  // Returns a {Promise} of the resulting file
  static combineThree(imageFiles, outputFile) {
    return ImageHelpers.combineTwo(imageFiles.slice(0, 2), outputFile).then(
      () => ImageHelpers.combineTwo([outputFile, imageFiles[2]], outputFile),
    );
  }
}

module.exports = ImageHelpers;
