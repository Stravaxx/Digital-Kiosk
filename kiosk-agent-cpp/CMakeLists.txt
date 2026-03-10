cmake_minimum_required(VERSION 3.20)
project(kiosk_agent VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(kiosk-agent
  src/main.cpp
  src/AgentApp.cpp
  src/platform/linux/LinuxServiceStub.cpp
  src/platform/windows/WindowsServiceStub.cpp
)

target_include_directories(kiosk-agent PRIVATE include)

if (WIN32)
  target_compile_definitions(kiosk-agent PRIVATE PLATFORM_WINDOWS=1)
else()
  target_compile_definitions(kiosk-agent PRIVATE PLATFORM_LINUX=1)
endif()
