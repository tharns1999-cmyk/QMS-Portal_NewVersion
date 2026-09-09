/**
 * pdfWatermarkService.js
 * 
 * Standardized ISO 9001 Watermarking Engine Proxy
 * Re-exports UniversalWatermarkService & utilities for complete backwards compatibility.
 */

import UniversalWatermarkService, {
  WATERMARK_TYPES,
  WATERMARK_PRESETS,
  getBangkokFormattedTimestamp,
  getBangkokFormattedDate,
  buildWatermarkSubLines,
  resolveWatermarkConfig,
  getWatermarkConfig,
  hexToRgb
} from './UniversalWatermarkService';

export {
  UniversalWatermarkService,
  WATERMARK_TYPES,
  WATERMARK_PRESETS,
  getBangkokFormattedTimestamp,
  getBangkokFormattedDate,
  buildWatermarkSubLines,
  resolveWatermarkConfig,
  getWatermarkConfig,
  hexToRgb
};

export default UniversalWatermarkService;
