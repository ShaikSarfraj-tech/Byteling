# A Docker container is not a tiny VM

Narration script (~58s, voice: Kokoro `af_heart`). No music; voice + subtle non-musical SFX only.

**[0.2s] Hook**  
A Docker container is not a tiny virtual machine.

**[3.3s] Hook**  
It's just a Linux process, wearing a disguise.

**[6.2s] VM: full guest OS + own kernel**  
A virtual machine boots a full guest operating system, with its own kernel. Heavy, and slow.

**[12.0s] Container shares the host kernel**  
A container skips all of that. It shares the host's kernel, and relies on three kernel features.

**[17.9s] Namespaces = what it can see**  
One: namespaces. They control what the process can see. Inside, it thinks it's process ID one, with its own network and hostname.

**[26.3s] cgroups = what it can use**  
Two: cgroups. They limit what it can use. Half a CPU, five hundred megabytes of RAM. Exceed the memory, and the kernel kills it.

**[35.3s] Layered filesystem**  
Three: a layered filesystem. Your image is a stack of read-only layers, with one thin writable layer on top.

**[42.7s] Proof: ps on the host**  
Don't believe me? Run ps on the host. Your container is right there, an ordinary process.

**[48.6s] Why it's fast and dense**  
That's why containers start in a fraction of a second, and one server can run hundreds of them.

**[53.9s] Takeaway**  
A container isn't a machine. It's a process with boundaries.

## Fact check
- Containers share the host kernel and are isolated with Linux **namespaces** (PID, network, mount, UTS/hostname, ...); inside a PID namespace the first process is PID 1.
- **cgroups** enforce resource limits: `docker run --cpus=0.5 --memory=500m`. Exceeding the CPU quota throttles the process; exceeding the memory limit gets it OOM-killed (exit code 137).
- Images are stacks of read-only layers (overlay filesystem); each container adds one thin writable layer.
- A containerised process is visible from the host with `ps` under a normal host PID.
