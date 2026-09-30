import { type Dispatcher, errors, interceptors } from 'undici';

/** 本文を蓄積する前に受信量を制限する。各応答の計数は独立する。 */
const responseSizeInterceptor =
  (maxBytes: number): Dispatcher.DispatcherComposeInterceptor =>
  (dispatch) =>
  (options, handler) => {
    let received = 0;
    const limitError = (): Error =>
      new errors.ResponseExceededMaxSizeError(`応答サイズが上限を超えています: ${maxBytes}`);
    return dispatch(options, {
      onRequestStart: (controller, context: unknown) => handler.onRequestStart?.(controller, context),
      onRequestUpgrade: (...args) => handler.onRequestUpgrade?.(...args),
      onResponseStart: (controller, status, headers, message) => {
        received = 0;
        if (Number(headers['content-length']) > maxBytes) {
          controller.abort(limitError());
          return;
        }
        return handler.onResponseStart?.(controller, status, headers, message);
      },
      onResponseData: (controller, chunk) => {
        received += chunk.length;
        if (received > maxBytes) {
          controller.abort(limitError());
          return;
        }
        return handler.onResponseData?.(controller, chunk);
      },
      onResponseEnd: (...args) => handler.onResponseEnd?.(...args),
      // ヘッダー受信と同時の中断でも、fetchの本文読み取り側へ失敗を通知する。
      onResponseError: (...args) => {
        setImmediate(() => handler.onResponseError?.(...args));
      },
    });
  };

/** 接続先検証を保持し、圧縮応答の各展開段階と非圧縮本文に上限を設ける。 */
export const limitResponseSize = (dispatcher: Dispatcher, maxBytes: number): Dispatcher => {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error('応答サイズの上限が不正です');
  return dispatcher.compose(
    interceptors.decompress({ maxSize: maxBytes, skipErrorResponses: false }),
    responseSizeInterceptor(maxBytes),
  );
};
