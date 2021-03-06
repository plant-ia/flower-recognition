import fs from 'fs/promises'
import tf from '@tensorflow/tfjs-node'
// import tf from '@tensorflow/tfjs-node-gpu'
import { shuffle, walk } from '../util/fn-util.js'

const trainFaction = 0.8

const classes = ['daisy', 'dandelion', 'roses', 'sunflowers', 'tulips']
const labelDict = {
  daisy: 0,
  dandelion: 1,
  roses: 2,
  sunflowers: 3,
  tulips: 4,
}

const imageWidth = 224
const imageHeight = 224
const imageChannels = 3
const batchSize = 32

// Convert image to model attempts
const toPixelData = path => {
  const imageBuffer = fs.readFileSync(path)
  const tfImage = tf.node.decodeImage(imageBuffer)
  const tfResizedImage = tf.image
    .resizeBilinear(tfImage, [imageWidth, imageHeight])
    // .toFloat()
    .div(tf.scalar(255))
  // .expandDims()

  return tfResizedImage
}

// Create training and tests sampleSets
const makeTrainAndTestSets = async () => {
  console.log('Split the data into train and test sets and get the label classes.')

  const fullFileNames = await walk('./flower_photos').then(res => res)
  const shuffledFullFileNames = shuffle(fullFileNames)

  const examples = shuffledFullFileNames.map(imgPath => {
    const label = imgPath.split('/')[1]
    const labelClass = labelDict[label]
    return [imgPath, labelClass]
  })

  const numTrain = parseInt(shuffledFullFileNames.length * trainFaction)
  const trainExamples = examples.slice(0, numTrain)
  const testExamples = examples.slice(numTrain, examples.length)

  console.log(`   The dataset has ${classes.length} label classes: ${classes}`)
  console.log(`   There are ${trainExamples.length} training images`)
  console.log(`   There are ${testExamples.length} test images`)

  return [trainExamples, testExamples, classes]
}

const buildModel = function () {
  const model = tf.sequential()

  // add the model layers
  model.add(tf.layers.conv2d({
    inputShape: [imageWidth, imageHeight, imageChannels],
    filters: 3,
    kernelSize: 5,
    padding: 'same',
    activation: 'relu',
  }))
  model.add(tf.layers.maxPooling2d({
    poolSize: 2,
    strides: 3,
  }))
  model.add(tf.layers.conv2d({
    filters: 16,
    kernelSize: 5,
    padding: 'same',
    activation: 'relu',
  }))
  model.add(tf.layers.maxPooling2d({
    poolSize: 3,
    strides: 3,
  }))
  model.add(tf.layers.flatten())
  model.add(tf.layers.dense({
    units: classes.length,
    activation: 'softmax',
  }))

  // compile the model
  model.compile({
    optimizer: 'adam', // tf.train.adam()
    // loss: 'categoricalCrossentropy',
    loss: 'sparseCategoricalCrossentropy',
    metrics: ['accuracy'],
  })

  return model
}

const runTraining = async (model, trainingDataSet, testDataSet) => {
  const transformedTrainData = trainingDataSet.map(el => toPixelData(el[0]))
  const transformedTrainLabel = trainingDataSet.map(el => el[1])
  const xTrainDataset = tf.data.array(transformedTrainData)
  const yTrainDataset = tf.data.array(transformedTrainLabel)
  const xyTrainDataset = tf.data.zip({ xs: xTrainDataset, ys: yTrainDataset })
    .batch(5)
    .shuffle(5)

  const transformedTestData = trainingDataSet.map(el => toPixelData(el[0]))
  const transformedTestLabel = trainingDataSet.map(el => el[1])
  const xTestDataset = tf.data.array(transformedTestData)
  const yTestDataset = tf.data.array(transformedTestLabel)
  const xyTestDataset = tf.data.zip({ xs: xTestDataset, ys: yTestDataset })
    .batch(5)
    .shuffle(5)
  // console.log(xyDataset)
  await model.fitDataset(xyTrainDataset, {
    batchSize,
    verbose: 1,
    epochs: 5,
    validationData: xyTestDataset,
  })
  await model.save('file://./models/my-model')
}

// Run
const run = async () => {
  console.log('Create train and test dataSet : ')
  const dataSets = await makeTrainAndTestSets()

  console.log('Loading model...')
  const model = buildModel()
  model.summary()

  console.log('Running training...')
  await runTraining(model, dataSets[0], dataSets[1])
}

run()
