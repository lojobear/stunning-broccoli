package com.logaan.clarityforge

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONObject
import org.tensorflow.lite.Interpreter
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class ClarityForgeLocalModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val executor = Executors.newSingleThreadExecutor()
    @Volatile private var esrgan: Interpreter? = null

    override fun getName() = "ClarityForgeLocal"

    @ReactMethod
    fun process(uri: String, tool: String, paramsJson: String, promise: Promise) {
        executor.execute {
            try {
                val params = try { JSONObject(paramsJson) } catch (_: Exception) { JSONObject() }
                val bitmap = loadBitmap(uri)
                val strength = params.optDouble("strength", 0.55).toFloat().coerceIn(0f, 1f)
                val result = when (tool) {
                    "upscale" -> aiUpscale(
                        bitmap,
                        params.optInt("scale", 2).coerceIn(2, 4),
                        params.optString("mode", "fast")
                    )
                    "sharpen" -> sharpen(bitmap, 0.45f + strength * 1.4f)
                    "sharpen_auto" -> sharpen(bitmap, 0.85f)
                    "unblur" -> sharpen(bitmap, 0.8f + strength * 1.8f)
                    "denoise" -> denoise(bitmap, 0.15f + strength * 0.55f)
                    "denoise_auto" -> denoise(bitmap, 0.42f)
                    "denoise_max" -> denoise(bitmap, 0.55f + strength * 0.35f)
                    "relight" -> relight(bitmap, params.optString("lighting", "balanced"))
                    "restore" -> sharpen(denoise(autoRelight(bitmap), 0.36f + strength * 0.25f), 0.65f + strength * 0.55f)
                    "autopilot", "smart_enhance" -> sharpen(denoise(autoRelight(bitmap), 0.28f + strength * 0.18f), 0.55f + strength * 0.45f)
                    else -> throw IllegalArgumentException("$tool is not available fully offline yet.")
                }
                if (result !== bitmap && !bitmap.isRecycled) bitmap.recycle()
                promise.resolve(saveBitmap(result))
                if (!result.isRecycled) result.recycle()
            } catch (e: Throwable) {
                promise.reject("LOCAL_PROCESSING_FAILED", e.message ?: "Local processing failed", e)
            }
        }
    }

    private fun openInput(uri: Uri): InputStream? = try {
        if (uri.scheme == "file") FileInputStream(uri.path!!) else context.contentResolver.openInputStream(uri)
    } catch (_: Exception) { null }

    private fun loadBitmap(uriString: String): Bitmap {
        val uri = Uri.parse(uriString)
        val orientation = try {
            openInput(uri)?.use { input ->
                ExifInterface(input).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
            } ?: ExifInterface.ORIENTATION_NORMAL
        } catch (_: Exception) { ExifInterface.ORIENTATION_NORMAL }

        val decoded = openInput(uri)?.use {
            BitmapFactory.decodeStream(it)?.copy(Bitmap.Config.ARGB_8888, true)
        } ?: throw IllegalArgumentException("Could not decode the selected image")
        return orientBitmap(decoded, orientation)
    }

    private fun orientBitmap(src: Bitmap, orientation: Int): Bitmap {
        if (orientation == ExifInterface.ORIENTATION_NORMAL || orientation == ExifInterface.ORIENTATION_UNDEFINED) return src
        val m = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> m.setScale(-1f, 1f)
            ExifInterface.ORIENTATION_ROTATE_180 -> m.setRotate(180f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> { m.setRotate(180f); m.postScale(-1f, 1f) }
            ExifInterface.ORIENTATION_TRANSPOSE -> { m.setRotate(90f); m.postScale(-1f, 1f) }
            ExifInterface.ORIENTATION_ROTATE_90 -> m.setRotate(90f)
            ExifInterface.ORIENTATION_TRANSVERSE -> { m.setRotate(-90f); m.postScale(-1f, 1f) }
            ExifInterface.ORIENTATION_ROTATE_270 -> m.setRotate(-90f)
            else -> return src
        }
        val out = Bitmap.createBitmap(src, 0, 0, src.width, src.height, m, true)
        if (out !== src && !src.isRecycled) src.recycle()
        return out
    }

    private fun saveBitmap(bitmap: Bitmap): String {
        val file = File(context.cacheDir, "clarityforge-local-${System.currentTimeMillis()}.jpg")
        FileOutputStream(file).use { out ->
            if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 95, out)) throw IllegalStateException("Could not save processed image")
        }
        return Uri.fromFile(file).toString()
    }

    private fun autoRelight(src: Bitmap): Bitmap {
        val pixels = IntArray(src.width * src.height)
        src.getPixels(pixels, 0, src.width, 0, 0, src.width, src.height)
        val step = max(1, pixels.size / 12000)
        var sum = 0.0
        var count = 0
        var i = 0
        while (i < pixels.size) {
            val c = pixels[i]
            sum += 0.2126 * Color.red(c) + 0.7152 * Color.green(c) + 0.0722 * Color.blue(c)
            count++
            i += step
        }
        val mean = if (count > 0) sum / count else 128.0
        val gain = (132.0 / max(35.0, mean)).coerceIn(0.78, 1.32).toFloat()
        return colorTransform(src, gain, if (mean < 95) 6f else 0f, 1.06f)
    }

    private fun relight(src: Bitmap, mode: String): Bitmap = when (mode) {
        "underexposed" -> colorTransform(src, 1.20f, 10f, 1.08f)
        "overexposed" -> colorTransform(src, 0.84f, -5f, 1.06f)
        "low_contrast" -> colorTransform(src, 1.10f, -9f, 1.16f)
        else -> autoRelight(src)
    }

    private fun colorTransform(src: Bitmap, gain: Float, offset: Float, contrast: Float): Bitmap {
        val out = Bitmap.createBitmap(src.width, src.height, Bitmap.Config.ARGB_8888)
        val centeredOffset = 128f * (1f - contrast) + offset
        val m = ColorMatrix(floatArrayOf(
            gain * contrast,0f,0f,0f,centeredOffset,
            0f,gain * contrast,0f,0f,centeredOffset,
            0f,0f,gain * contrast,0f,centeredOffset,
            0f,0f,0f,1f,0f
        ))
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { colorFilter = ColorMatrixColorFilter(m) }
        Canvas(out).drawBitmap(src, 0f, 0f, paint)
        return out
    }

    private fun sharpen(src: Bitmap, amount: Float): Bitmap {
        val w = src.width; val h = src.height
        if (w < 3 || h < 3) return src.copy(Bitmap.Config.ARGB_8888, false)
        val p = IntArray(w * h); src.getPixels(p, 0, w, 0, 0, w, h)
        val out = p.clone()
        fun clamp(v: Float) = v.roundToInt().coerceIn(0, 255)
        for (y in 1 until h - 1) {
            var i = y * w + 1
            for (x in 1 until w - 1) {
                val c = p[i]
                val n1 = p[i - 1]; val n2 = p[i + 1]; val n3 = p[i - w]; val n4 = p[i + w]
                val ar = (Color.red(n1)+Color.red(n2)+Color.red(n3)+Color.red(n4)) * 0.25f
                val ag = (Color.green(n1)+Color.green(n2)+Color.green(n3)+Color.green(n4)) * 0.25f
                val ab = (Color.blue(n1)+Color.blue(n2)+Color.blue(n3)+Color.blue(n4)) * 0.25f
                val r = clamp(Color.red(c) + amount * (Color.red(c) - ar))
                val g = clamp(Color.green(c) + amount * (Color.green(c) - ag))
                val b = clamp(Color.blue(c) + amount * (Color.blue(c) - ab))
                out[i] = Color.argb(Color.alpha(c), r, g, b)
                i++
            }
        }
        return Bitmap.createBitmap(out, w, h, Bitmap.Config.ARGB_8888)
    }

    private fun denoise(src: Bitmap, blend: Float): Bitmap {
        val w = src.width; val h = src.height
        if (w < 3 || h < 3) return src.copy(Bitmap.Config.ARGB_8888, false)
        val p = IntArray(w * h); src.getPixels(p, 0, w, 0, 0, w, h)
        val out = p.clone(); val a = blend.coerceIn(0f, 0.95f)
        fun mix(c: Int, avg: Float) = (c * (1f-a) + avg * a).roundToInt().coerceIn(0,255)
        for (y in 1 until h - 1) {
            var i = y * w + 1
            for (x in 1 until w - 1) {
                val c = p[i]
                var rr=0; var gg=0; var bb=0
                val ids = intArrayOf(i-w-1,i-w,i-w+1,i-1,i+1,i+w-1,i+w,i+w+1)
                for (id in ids) { val v=p[id]; rr+=Color.red(v); gg+=Color.green(v); bb+=Color.blue(v) }
                out[i] = Color.argb(Color.alpha(c), mix(Color.red(c),rr/8f), mix(Color.green(c),gg/8f), mix(Color.blue(c),bb/8f))
                i++
            }
        }
        return Bitmap.createBitmap(out, w, h, Bitmap.Config.ARGB_8888)
    }

    private fun getEsrgan(): Interpreter {
        esrgan?.let { return it }
        synchronized(this) {
            esrgan?.let { return it }
            val bytes = context.assets.open("ESRGAN.tflite").use { it.readBytes() }
            val buffer = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder())
            buffer.put(bytes); buffer.rewind()
            val threads = Runtime.getRuntime().availableProcessors().coerceIn(2, 6)
            val options = Interpreter.Options().apply {
                setNumThreads(threads)
                setUseXNNPACK(true)
                setUseNNAPI(true)
            }
            return Interpreter(buffer, options).also { esrgan = it }
        }
    }

    private class EsrganWorkspace(inW: Int, inH: Int, outW: Int, outH: Int) {
        val tile = Bitmap.createBitmap(inW, inH, Bitmap.Config.ARGB_8888)
        val tileCanvas = Canvas(tile)
        val inputPixels = IntArray(inW * inH)
        val input = ByteBuffer.allocateDirect(inW * inH * 3 * 4).order(ByteOrder.nativeOrder())
        val output = ByteBuffer.allocateDirect(outW * outH * 3 * 4).order(ByteOrder.nativeOrder())
        val outputPixels = IntArray(outW * outH)
        val outputBitmap = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)

        fun recycle() {
            if (!tile.isRecycled) tile.recycle()
            if (!outputBitmap.isRecycled) outputBitmap.recycle()
        }
    }

    private fun aiUpscale(original: Bitmap, requestedScale: Int, mode: String): Bitmap {
        val scale = if (requestedScale >= 4) 4 else 2
        val maxInputEdge = if (mode == "quality") {
            4096 / scale
        } else {
            if (scale == 4) 768 else 1024
        }
        val longEdge = max(original.width, original.height)
        val source = if (longEdge > maxInputEdge) {
            val s = maxInputEdge.toFloat() / longEdge
            Bitmap.createScaledBitmap(original, max(1,(original.width*s).roundToInt()), max(1,(original.height*s).roundToInt()), true)
        } else original

        val interpreter = getEsrgan()
        val inputShape = interpreter.getInputTensor(0).shape()
        val outputShape = interpreter.getOutputTensor(0).shape()
        val tileH = inputShape[1]; val tileW = inputShape[2]
        val modelOutH = outputShape[1]; val modelOutW = outputShape[2]
        val modelScaleX = modelOutW / tileW
        val modelScaleY = modelOutH / tileH
        if (modelScaleX < scale || modelScaleY < scale) throw IllegalStateException("ESRGAN model scale is smaller than requested scale")

        val result = Bitmap.createBitmap(source.width * scale, source.height * scale, Bitmap.Config.ARGB_8888)
        val resultCanvas = Canvas(result)
        val paint = Paint(Paint.FILTER_BITMAP_FLAG)
        val work = EsrganWorkspace(tileW, tileH, modelOutW, modelOutH)

        try {
            var y = 0
            while (y < source.height) {
                val actualH = min(tileH, source.height - y)
                var x = 0
                while (x < source.width) {
                    val actualW = min(tileW, source.width - x)
                    work.tile.eraseColor(Color.BLACK)
                    work.tileCanvas.drawBitmap(source, Rect(x,y,x+actualW,y+actualH), Rect(0,0,actualW,actualH), paint)
                    runEsrganTile(interpreter, work, tileW, tileH, modelOutW, modelOutH)
                    val srcRect = Rect(0, 0, actualW * modelScaleX, actualH * modelScaleY)
                    val dstRect = Rect(x * scale, y * scale, (x + actualW) * scale, (y + actualH) * scale)
                    resultCanvas.drawBitmap(work.outputBitmap, srcRect, dstRect, paint)
                    x += tileW
                }
                y += tileH
            }
        } finally {
            work.recycle()
            if (source !== original && !source.isRecycled) source.recycle()
        }
        return result
    }

    private fun runEsrganTile(interpreter: Interpreter, work: EsrganWorkspace, inW: Int, inH: Int, outW: Int, outH: Int) {
        work.tile.getPixels(work.inputPixels, 0, inW, 0, 0, inW, inH)
        work.input.clear()
        for (c in work.inputPixels) {
            work.input.putFloat(Color.red(c).toFloat())
            work.input.putFloat(Color.green(c).toFloat())
            work.input.putFloat(Color.blue(c).toFloat())
        }
        work.input.rewind()
        work.output.clear()
        interpreter.run(work.input, work.output)
        work.output.rewind()
        var k = 0
        while (k < work.outputPixels.size) {
            val r = work.output.getFloat().roundToInt().coerceIn(0,255)
            val g = work.output.getFloat().roundToInt().coerceIn(0,255)
            val b = work.output.getFloat().roundToInt().coerceIn(0,255)
            work.outputPixels[k++] = Color.rgb(r,g,b)
        }
        work.outputBitmap.setPixels(work.outputPixels, 0, outW, 0, 0, outW, outH)
    }
}
