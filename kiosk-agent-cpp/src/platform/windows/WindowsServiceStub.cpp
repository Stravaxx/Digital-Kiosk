#include <iostream>

namespace agent::platform::windows_stub {

void print_service_hint() {
  std::cout << "Windows service mode: register kiosk-agent with SCM" << std::endl;
}

} // namespace agent::platform::windows_stub
