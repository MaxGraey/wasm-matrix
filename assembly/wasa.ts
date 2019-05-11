// Required stuff from wasa
// https://github.com/jedisct1/wasa

import "allocator/arena";
import {
  errno,
  clockid,
  fd_write,
  fd_read,
  random_get,
  clock_time_get,
  clock_res_get,
  proc_exit,
  environ_sizes_get,
  environ_get,
  args_sizes_get,
  args_get,
  path_open,
  oflags,
  rights,
  lookupflags,
  fd,
  fdflags,
  fd_close,
} from 'bindings/wasi';

export type Descriptor = fd;

export class IO {
  /**
   * Close a file descriptor
   * @param fd file descriptor
   */
  static close(fd: Descriptor): void {
    fd_close(fd);
  }

  /**
   * Write data to a file descriptor
   * @param fd file descriptor
   * @param data data
   */
  static write(fd: Descriptor, data: Array<u8>): void {
    let data_buf_len = data.length;
    let data_buf = memory.allocate(data_buf_len);
    for (let i = 0; i < data_buf_len; i++) {
      store<u8>(data_buf + i, unchecked(data[i]));
    }
    let iov = memory.allocate(2 * sizeof<usize>());
    store<u32>(iov, data_buf);
    store<u32>(iov + sizeof<usize>(), data_buf_len);
    let written_ptr = memory.allocate(sizeof<usize>());
    fd_write(fd, iov, 1, written_ptr);
    memory.free(written_ptr);
    memory.free(data_buf);
  }

  /**
   * Write a string to a file descriptor, after encoding it to UTF8
   * @param fd file descriptor
   * @param s string
   * @param newline `true` to add a newline after the string
   */
  static writeString(fd: Descriptor, s: string, newline: bool = false): void {
    if (newline) {
      this.writeStringLn(fd, s);
      return;
    }
    let s_utf8_len: usize = s.lengthUTF8 - 1;
    let s_utf8 = s.toUTF8();
    let iov = memory.allocate(2 * sizeof<usize>());
    store<u32>(iov, s_utf8);
    store<u32>(iov + sizeof<usize>(), s_utf8_len);
    let written_ptr = memory.allocate(sizeof<usize>());
    fd_write(fd, iov, 1, written_ptr);
    memory.free(written_ptr);
    memory.free(s_utf8);
  }

  /**
   * Write a string to a file descriptor, after encoding it to UTF8, with a newline
   * @param fd file descriptor
   * @param s string
   */
  static writeStringLn(fd: Descriptor, s: string): void {
    let s_utf8_len: usize = s.lengthUTF8 - 1;
    let s_utf8 = s.toUTF8();
    let iov = memory.allocate(4 * sizeof<usize>());
    store<u32>(iov, s_utf8);
    store<u32>(iov + sizeof<usize>(), s_utf8_len);
    let lf = memory.allocate(1);
    store<u8>(lf, 10);
    store<u32>(iov + sizeof<usize>() * 2, lf);
    store<u32>(iov + sizeof<usize>() * 3, 1);
    let written_ptr = memory.allocate(sizeof<usize>());
    fd_write(fd, iov, 2, written_ptr);
    memory.free(written_ptr);
    memory.free(s_utf8);
  }

  /**
   * Read data from a file descriptor
   * @param fd file descriptor
   * @param data existing array to push data to
   * @param chunk_size chunk size (default: 4096)
   */
  static read(fd: Descriptor, data: Array<u8> = [], chunk_size: usize = 4096): Array<u8> | null {
    let data_partial_len = chunk_size;
    let data_partial = memory.allocate(data_partial_len);
    let iov = memory.allocate(2 * sizeof<usize>());
    store<u32>(iov, data_partial);
    store<u32>(iov + sizeof<usize>(), data_partial_len);
    let read_ptr = memory.allocate(sizeof<usize>());
    fd_read(fd, iov, 1, read_ptr);
    let read = load<usize>(read_ptr);
    if (read > 0) {
      for (let i: usize = 0; i < read; i++) {
        data.push(load<u8>(data_partial + i));
      }
    }
    memory.free(read_ptr);
    memory.free(data_partial);

    if (read <= 0) {
      return null;
    }
    return data;
  }

  /**
   * Read from a file descriptor until the end of the stream
   * @param fd file descriptor
   * @param data existing array to push data to
   * @param chunk_size chunk size (default: 4096)
   */
  static readAll(fd: Descriptor, data: Array<u8> = [], chunk_size: usize = 4096): Array<u8> | null {
    let data_partial_len = chunk_size;
    let data_partial = memory.allocate(data_partial_len);
    let iov = memory.allocate(2 * sizeof<usize>());
    store<u32>(iov, data_partial);
    store<u32>(iov + sizeof<usize>(), data_partial_len);
    let read_ptr = memory.allocate(sizeof<usize>());
    let read: usize = 0;
    for (; ;) {
      if (fd_read(fd, iov, 1, read_ptr) != errno.SUCCESS) {
        break;
      }
      read = load<usize>(read_ptr);
      if (read <= 0) {
        break;
      }
      for (let i: usize = 0; i < read; i++) {
        data.push(load<u8>(data_partial + i));
      }
    }
    memory.free(read_ptr);
    memory.free(data_partial);

    if (read < 0) {
      return null;
    }
    return data;
  }

  /**
   * Read an UTF8 string from a file descriptor, convert it to a native string
   * @param fd file descriptor
   * @param chunk_size chunk size (default: 4096)
   */
  static readString(fd: Descriptor, chunk_size: usize = 4096): string | null {
    let s_utf8_ = IO.readAll(fd);
    if (s_utf8_ === null) {
      return null;
    }
    let s_utf8 = s_utf8_!;
    let s_utf8_len = s_utf8.length;
    let s_utf8_buf = memory.allocate(s_utf8_len);
    for (let i = 0; i < s_utf8_len; i++) {
      store<u8>(s_utf8_buf + i, s_utf8[i]);
    }
    let s = String.fromUTF8(s_utf8_buf, s_utf8.length);
    memory.free(s_utf8_buf);

    return s;
  }
}

@global
export class Console {
  /**
   * Write a string to the console
   * @param s string
   * @param newline `false` to avoid inserting a newline after the string
   */
  static write(s: string, newline: bool = true): void {
    IO.writeString(1, s, newline);
  }

  /**
   * Read an UTF8 string from the console, convert it to a native string
   */
  static readAll(): string | null {
    return IO.readString(0);
  }

  /**
   * Alias for `Console.write()`
   */
  static log(s: string): void {
    this.write(s);
  }

  /**
   * Write an error to the console
   * @param s string
   * @param newline `false` to avoid inserting a newline after the string
   */
  static error(s: string, newline: bool = true): void {
    IO.writeString(2, s, newline);
  }
}

