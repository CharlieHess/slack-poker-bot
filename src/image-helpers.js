const rx = require('rx');
const lwip = require('lwip');

class ImageHelpers {

  static combineTwo(imagePaths, outputFile) {
    rx.Observable.fromArray(imagePaths)
      .concatMap((path) => ImageHelpers.imageFromFile(path))
      .bufferWithCount(2)
      .flatMap((images) => ImageHelpers.pasteTwo(images[0], images[1]))
      .map((combined) => ImageHelpers.imageToFile(combined, outputFile))
      .subscribe();
  }
  
  static combineThree(imagePaths, outputFile) {
    rx.Observable.fromArray(imagePaths)
      .concatMap((path) => ImageHelpers.imageFromFile(path))
      .bufferWithCount(3)
      .flatMap((images) => ImageHelpers.pasteThree(images[0], images[1], images[2]))
      .map((combined) => ImageHelpers.imageToFile(combined, outputFile))
      .subscribe();
  }
  
  static imageFromFile(path) {
    return rx.Observable.create((subj) => {
      lwip.open(path, (err, image) => {
        if (!err) {
          subj.onNext(image);
          subj.onCompleted();
        } else {
          subj.onError(err);
        }
      });
    });
  }
  
  static pasteThree(first, second, third) {
    return ImageHelpers.pasteTwo(first, second)
      .flatMap((combined) => ImageHelpers.pasteTwo(combined, third));
  }
  
  static pasteTwo(first, second) {
    let subj = new rx.Subject();
    
    let originalWidth = first.width();
    let originalHeight = first.height();
    let additionalWidth = second.width();
      
    // Create a blank image that has enough space for both, with a white
    // background.
    lwip.create(originalWidth + additionalWidth, originalHeight, 'white', (err, blankImage) => {
      if (err) subj.onError(err);
      
      blankImage.paste(0, 0, first, (err, hasFirstImage) => {
        if (err) subj.onError(err);

        hasFirstImage.paste(originalWidth, 0, second, (err, combinedImage) => {
          if (err) subj.onError(err);

          subj.onNext(combinedImage);
          subj.onCompleted();
        });
      });
    });
    
    return subj;
  }
  
  static imageToFile(image, outputFile) {
    let subj = new rx.Subject();

    image.writeFile(outputFile, (err) => {
      if (!err) {
        subj.onNext(outputFile);
        subj.onCompleted();
      } else {
        subj.onError(err);
      }
    });
    
    return subj;
  }
}

module.exports = ImageHelpers;