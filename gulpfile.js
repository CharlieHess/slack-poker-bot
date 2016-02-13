var gulp = require('gulp');
var mocha = require('gulp-mocha');
 
gulp.task('default', function () {
  return gulp.src('tests/*.js', {read: false})
    .pipe(mocha({reporter: 'spec'}));
});

gulp.task('ofc', function () {
  return gulp.src('tests/chinese-poker-spec.js', {read: false})
    .pipe(mocha({reporter: 'spec'}));
});
