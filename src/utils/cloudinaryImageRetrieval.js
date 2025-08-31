import { buildUrl } from 'cloudinary-build-url'

export function getCloudinaryImage(cloudinaryImageId) {
  const url = buildUrl(cloudinaryImageId, {
    cloud: {
      cloudName: 'medoptics-image-cloud',
    },
  })
  return url
}

export function getCloudinaryImageBlur(cloudinaryImageId) {
  const blurUrl = buildUrl(cloudinaryImageId, {
    cloud: {
      cloudName: 'medoptics-image-cloud',
    },
    transformations: {
      effect: 'blur:1000',
      quality: 1,
    },
  })
  return blurUrl
}

