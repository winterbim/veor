#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <linux/landlock.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <unistd.h>

#ifndef __NR_landlock_create_ruleset
#define __NR_landlock_create_ruleset 444
#define __NR_landlock_add_rule 445
#define __NR_landlock_restrict_self 446
#endif

#ifndef LANDLOCK_CREATE_RULESET_VERSION
#define LANDLOCK_CREATE_RULESET_VERSION (1U << 0)
#endif

static int ll_create(const struct landlock_ruleset_attr *attr, size_t size, uint32_t flags) {
  return (int)syscall(__NR_landlock_create_ruleset, attr, size, flags);
}
static int ll_add(int fd, enum landlock_rule_type type, const void *attr, uint32_t flags) {
  return (int)syscall(__NR_landlock_add_rule, fd, type, attr, flags);
}
static int ll_restrict(int fd, uint32_t flags) {
  return (int)syscall(__NR_landlock_restrict_self, fd, flags);
}

static uint64_t access_for_abi(int abi) {
  uint64_t access =
    LANDLOCK_ACCESS_FS_EXECUTE |
    LANDLOCK_ACCESS_FS_WRITE_FILE |
    LANDLOCK_ACCESS_FS_READ_FILE |
    LANDLOCK_ACCESS_FS_READ_DIR |
    LANDLOCK_ACCESS_FS_REMOVE_DIR |
    LANDLOCK_ACCESS_FS_REMOVE_FILE |
    LANDLOCK_ACCESS_FS_MAKE_CHAR |
    LANDLOCK_ACCESS_FS_MAKE_DIR |
    LANDLOCK_ACCESS_FS_MAKE_REG |
    LANDLOCK_ACCESS_FS_MAKE_SOCK |
    LANDLOCK_ACCESS_FS_MAKE_FIFO |
    LANDLOCK_ACCESS_FS_MAKE_BLOCK |
    LANDLOCK_ACCESS_FS_MAKE_SYM;
#ifdef LANDLOCK_ACCESS_FS_REFER
  if (abi >= 2) access |= LANDLOCK_ACCESS_FS_REFER;
#endif
#ifdef LANDLOCK_ACCESS_FS_TRUNCATE
  if (abi >= 3) access |= LANDLOCK_ACCESS_FS_TRUNCATE;
#endif
  return access;
}

static int add_path(int ruleset, const char *path, uint64_t allowed) {
  int fd = open(path, O_PATH | O_CLOEXEC);
  if (fd < 0) {
    fprintf(stderr, "landlock: open %s: %s\n", path, strerror(errno));
    return -1;
  }
  struct landlock_path_beneath_attr attr = {
    .allowed_access = allowed,
    .parent_fd = fd,
  };
  int rc = ll_add(ruleset, LANDLOCK_RULE_PATH_BENEATH, &attr, 0);
  int saved = errno;
  close(fd);
  if (rc < 0) {
    fprintf(stderr, "landlock: add %s: %s\n", path, strerror(saved));
    return -1;
  }
  return 0;
}

int main(int argc, char **argv) {
  const char *ro[64];
  const char *rw[64];
  int nro = 0;
  int nrw = 0;
  int i = 1;
  for (; i < argc; i++) {
    if (strcmp(argv[i], "--") == 0) { i++; break; }
    if (strcmp(argv[i], "--ro") == 0 && i + 1 < argc) { ro[nro++] = argv[++i]; continue; }
    if (strcmp(argv[i], "--rw") == 0 && i + 1 < argc) { rw[nrw++] = argv[++i]; continue; }
    fprintf(stderr, "landlock: unknown argument %s\n", argv[i]);
    return 2;
  }
  if (i >= argc || nrw < 1) {
    fprintf(stderr, "usage: landlock-exec --rw DIR [--ro DIR] -- COMMAND\n");
    return 2;
  }

  int abi = ll_create(NULL, 0, LANDLOCK_CREATE_RULESET_VERSION);
  if (abi < 1) {
    fprintf(stderr, "landlock: unavailable (%s)\n", strerror(errno));
    return 127;
  }
  uint64_t handled = access_for_abi(abi);
  struct landlock_ruleset_attr ruleset_attr = { .handled_access_fs = handled };
  int ruleset = ll_create(&ruleset_attr, sizeof(ruleset_attr), 0);
  if (ruleset < 0) {
    fprintf(stderr, "landlock: create ruleset: %s\n", strerror(errno));
    return 127;
  }

  uint64_t read_only = LANDLOCK_ACCESS_FS_EXECUTE | LANDLOCK_ACCESS_FS_READ_FILE | LANDLOCK_ACCESS_FS_READ_DIR;
  if (add_path(ruleset, "/", read_only) != 0) return 127;
  for (int n = 0; n < nro; n++) {
    if (add_path(ruleset, ro[n], read_only) != 0) return 127;
  }
  uint64_t write_bits = handled & ~read_only;
  uint64_t read_write = read_only | write_bits;
  for (int n = 0; n < nrw; n++) {
    if (add_path(ruleset, rw[n], read_write) != 0) return 127;
  }

  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0) {
    fprintf(stderr, "landlock: no_new_privs: %s\n", strerror(errno));
    return 127;
  }
  if (ll_restrict(ruleset, 0) != 0) {
    fprintf(stderr, "landlock: restrict: %s\n", strerror(errno));
    return 127;
  }
  close(ruleset);
  execvp(argv[i], &argv[i]);
  fprintf(stderr, "landlock: exec: %s\n", strerror(errno));
  return 127;
}
