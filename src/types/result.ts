export interface Result {
  classname: string;
  confidence: string;
  green_only_image: string
  non_green_only_image: string
  detection_image: string
  segmented_image: string
  green_pixel_count: number,
  non_green_pixel_count: number,
  severity: number
}
